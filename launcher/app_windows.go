//go:build windows

// ============================================================
// Baghdo's Workshop OS — portable desktop environment (single EXE)
// ============================================================
// One EXE → black loading screen → sign-in (local profiles) → a desktop that
// launches the visual builder and other tools → sign out. Profiles + all data
// live locally inside the EXE's own folder. Extra "apps" can be dropped into an
// ./apps folder (any .html file) and they show up on the desktop.
// Embedded WebView2 (OS component on Win10/11) — no Node, no browser, no server.
// Cross-compiles: GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -trimpath
// ============================================================
package main

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	webview "github.com/jchv/go-webview2"
)

//go:embed ui/app.html
var appHTML string

const (
	appName    = "Baghdo's Workshop"
	appVersion = "3.0.0"
)

var (
	rootDir, profilesDir, logsDir, exportsDir, resourcesDir, appsDir, appDataDir string
)

func initPaths() {
	exe, err := os.Executable()
	if err != nil {
		exe, _ = filepath.Abs(os.Args[0])
	}
	rootDir = filepath.Dir(exe)
	appDataDir = filepath.Join(rootDir, "app-data")
	profilesDir = filepath.Join(appDataDir, "profiles")
	logsDir = filepath.Join(rootDir, "logs")
	exportsDir = filepath.Join(rootDir, "exports")
	resourcesDir = filepath.Join(rootDir, "resources")
	appsDir = filepath.Join(rootDir, "apps")
	for _, d := range []string{profilesDir, logsDir, exportsDir, resourcesDir, appsDir} {
		_ = os.MkdirAll(d, 0o755)
	}
}

func writeLog(file, format string, a ...any) {
	f, err := os.OpenFile(filepath.Join(logsDir, file), os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		return
	}
	defer f.Close()
	fmt.Fprintf(f, "%s  %s\n", time.Now().Format("2006-01-02 15:04:05"), fmt.Sprintf(format, a...))
}
func startupLog(format string, a ...any) { writeLog("startup.log", format, a...) }

func safeName(name string) string {
	b := filepath.Base(strings.TrimSpace(name))
	if b == "" || b == "." || b == ".." || b == string(filepath.Separator) {
		return "default"
	}
	return b
}
func profileDir(p string) string { return filepath.Join(profilesDir, safeName(p)) }

// --- profiles --------------------------------------------------------------

func appListProfiles() string {
	entries, _ := os.ReadDir(profilesDir)
	names := []string{}
	for _, e := range entries {
		if e.IsDir() {
			names = append(names, e.Name())
		}
	}
	out, _ := json.Marshal(names)
	return string(out)
}

func appCreateProfile(name, pin string) string {
	d := profileDir(name)
	_ = os.MkdirAll(filepath.Join(d, "projects"), 0o755)
	_ = os.MkdirAll(filepath.Join(d, "data"), 0o755)
	meta, _ := json.Marshal(map[string]string{"pin": pin, "created": time.Now().Format(time.RFC3339)})
	_ = os.WriteFile(filepath.Join(d, "meta.json"), meta, 0o644)
	writeLog("app.log", "profile created: %s", safeName(name))
	return "ok"
}

func appProfilePin(name string) string {
	b, err := os.ReadFile(filepath.Join(profileDir(name), "meta.json"))
	if err != nil {
		return ""
	}
	var m map[string]string
	if json.Unmarshal(b, &m) != nil {
		return ""
	}
	return m["pin"]
}

func appDeleteProfile(name string) string {
	if err := os.RemoveAll(profileDir(name)); err != nil {
		return "error"
	}
	return "ok"
}

// --- per-profile projects (the visual builder) -----------------------------

func appSaveProject(profile, name, content string) string {
	dir := filepath.Join(profileDir(profile), "projects", safeName(name))
	_ = os.MkdirAll(filepath.Join(dir, "backups"), 0o755)
	target := filepath.Join(dir, "project.json")
	if old, err := os.ReadFile(target); err == nil {
		_ = os.WriteFile(filepath.Join(dir, "backups", "project-"+time.Now().Format("20060102-150405")+".json"), old, 0o644)
	}
	if err := os.WriteFile(target, []byte(content), 0o644); err != nil {
		return "error"
	}
	return "ok"
}
func appLoadProject(profile, name string) string {
	b, err := os.ReadFile(filepath.Join(profileDir(profile), "projects", safeName(name), "project.json"))
	if err != nil {
		return ""
	}
	return string(b)
}
func appListProjects(profile string) string {
	entries, _ := os.ReadDir(filepath.Join(profileDir(profile), "projects"))
	names := []string{}
	for _, e := range entries {
		if e.IsDir() {
			if _, err := os.Stat(filepath.Join(profileDir(profile), "projects", e.Name(), "project.json")); err == nil {
				names = append(names, e.Name())
			}
		}
	}
	out, _ := json.Marshal(names)
	return string(out)
}

// --- per-profile generic data (notes + the simple tool apps) ---------------

func appSaveData(profile, key, content string) string {
	_ = os.MkdirAll(filepath.Join(profileDir(profile), "data"), 0o755)
	if err := os.WriteFile(filepath.Join(profileDir(profile), "data", safeName(key)+".json"), []byte(content), 0o644); err != nil {
		return "error"
	}
	return "ok"
}
func appLoadData(profile, key string) string {
	b, err := os.ReadFile(filepath.Join(profileDir(profile), "data", safeName(key)+".json"))
	if err != nil {
		return ""
	}
	return string(b)
}

// --- folder apps (drop any .html into ./apps) ------------------------------

func appListApps() string {
	entries, _ := os.ReadDir(appsDir)
	names := []string{}
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(strings.ToLower(e.Name()), ".html") {
			names = append(names, e.Name())
		}
	}
	out, _ := json.Marshal(names)
	return string(out)
}
func appReadApp(name string) string {
	b, err := os.ReadFile(filepath.Join(appsDir, safeName(name)))
	if err != nil {
		return ""
	}
	return string(b)
}

// --- exports ---------------------------------------------------------------

func appExport(name, content string) string {
	n := safeName(name)
	if filepath.Ext(n) == "" {
		n += ".html"
	}
	if err := os.WriteFile(filepath.Join(exportsDir, n), []byte(content), 0o644); err != nil {
		return "error"
	}
	shellOpen(exportsDir)
	return "ok"
}

func main() {
	initPaths()
	startupLog("== %s OS v%s starting ==", appName, appVersion)
	startupLog("root: %s", rootDir)

	w := webview.NewWithOptions(webview.WebViewOptions{
		Debug:     false,
		DataPath:  filepath.Join(appDataDir, "webview"),
		AutoFocus: true,
		WindowOptions: webview.WindowOptions{Title: appName, Width: 1280, Height: 820, Center: true},
	})
	if w == nil {
		startupLog("WebView2 runtime not available")
		messageBox("Couldn't start the display engine.\n\n"+appName+" uses Microsoft WebView2, built into Windows 10 and 11.\nIf it's missing, install the free \"Evergreen WebView2 Runtime\" from Microsoft once, then reopen.", appName, mbOK|mbIconError)
		return
	}
	defer w.Destroy()
	w.SetSize(980, 660, webview.HintMin)

	w.Bind("appListProfiles", appListProfiles)
	w.Bind("appCreateProfile", appCreateProfile)
	w.Bind("appProfilePin", appProfilePin)
	w.Bind("appDeleteProfile", appDeleteProfile)
	w.Bind("appSaveProject", appSaveProject)
	w.Bind("appLoadProject", appLoadProject)
	w.Bind("appListProjects", appListProjects)
	w.Bind("appSaveData", appSaveData)
	w.Bind("appLoadData", appLoadData)
	w.Bind("appListApps", appListApps)
	w.Bind("appReadApp", appReadApp)
	w.Bind("appExport", appExport)
	w.Bind("appOpenFolder", func() { shellOpen(rootDir) })
	w.Bind("appLog", func(m string) { writeLog("app.log", "ui: %s", m) })

	w.SetHtml(appHTML)
	startupLog("window opened — running")
	w.Run()
	startupLog("closed")
}
