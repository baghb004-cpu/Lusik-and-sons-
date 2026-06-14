//go:build windows

// ============================================================
// Baghdo's Workshop — portable visual builder (single self-contained EXE)
// ============================================================
// One EXE. Opens a clean app window (embedded WebView2 — an OS component on
// Windows 10/11, NOT a browser the user opens, NO localhost, NO Node) showing a
// black loading screen, then a visual drag-and-drop builder. The whole UI is
// embedded in the EXE. Everything is portable: all paths are relative to the
// EXE and the only writes are inside the EXE's own folder (projects / logs /
// exports / app-data). Cross-compiles from any OS:
//   GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build
// ============================================================
package main

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	webview "github.com/jchv/go-webview2"
)

//go:embed ui/app.html
var appHTML string

const (
	appName    = "Baghdo's Workshop"
	appVersion = "2.0.0"
)

var (
	rootDir, projectsDir, logsDir, exportsDir, resourcesDir, appDataDir string
)

func initPaths() {
	exe, err := os.Executable()
	if err != nil {
		exe, _ = filepath.Abs(os.Args[0])
	}
	rootDir = filepath.Dir(exe)
	projectsDir = filepath.Join(rootDir, "projects")
	logsDir = filepath.Join(rootDir, "logs")
	exportsDir = filepath.Join(rootDir, "exports")
	resourcesDir = filepath.Join(rootDir, "resources")
	appDataDir = filepath.Join(rootDir, "app-data")
	for _, d := range []string{projectsDir, logsDir, exportsDir, resourcesDir, appDataDir} {
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

// safe turns a user-supplied name into a single, safe folder/file name.
func safeName(name string) string {
	b := filepath.Base(name)
	if b == "" || b == "." || b == ".." || b == string(filepath.Separator) {
		return "untitled"
	}
	return b
}

// --- functions the UI can call (in-process; no server, no network) ---------

// appSaveProject writes projects/<name>/project.json, backing up any previous.
func appSaveProject(name, content string) string {
	n := safeName(name)
	dir := filepath.Join(projectsDir, n)
	_ = os.MkdirAll(filepath.Join(dir, "backups"), 0o755)
	_ = os.MkdirAll(filepath.Join(dir, "assets"), 0o755)
	target := filepath.Join(dir, "project.json")
	if old, err := os.ReadFile(target); err == nil {
		_ = os.WriteFile(filepath.Join(dir, "backups", "project-"+time.Now().Format("20060102-150405")+".json"), old, 0o644)
	}
	if err := os.WriteFile(target, []byte(content), 0o644); err != nil {
		writeLog("app.log", "save project %s failed: %v", n, err)
		return "error"
	}
	writeLog("app.log", "saved project %s (%d bytes)", n, len(content))
	return "ok"
}

func appLoadProject(name string) string {
	b, err := os.ReadFile(filepath.Join(projectsDir, safeName(name), "project.json"))
	if err != nil {
		return ""
	}
	return string(b)
}

func appListProjects() string {
	entries, err := os.ReadDir(projectsDir)
	names := []string{}
	if err == nil {
		for _, e := range entries {
			if e.IsDir() {
				if _, err := os.Stat(filepath.Join(projectsDir, e.Name(), "project.json")); err == nil {
					names = append(names, e.Name())
				}
			}
		}
	}
	out, _ := json.Marshal(names)
	return string(out)
}

func appDeleteProject(name string) string {
	if err := os.RemoveAll(filepath.Join(projectsDir, safeName(name))); err != nil {
		return "error"
	}
	writeLog("app.log", "deleted project %s", safeName(name))
	return "ok"
}

func appSaveSettings(content string) string {
	_ = os.WriteFile(filepath.Join(appDataDir, "settings.json"), []byte(content), 0o644)
	return "ok"
}
func appLoadSettings() string {
	b, err := os.ReadFile(filepath.Join(appDataDir, "settings.json"))
	if err != nil {
		return ""
	}
	return string(b)
}

// appExport writes a finished file to exports/ and opens the folder.
func appExport(name, content string) string {
	n := safeName(name)
	if filepath.Ext(n) == "" {
		n += ".html"
	}
	if err := os.WriteFile(filepath.Join(exportsDir, n), []byte(content), 0o644); err != nil {
		writeLog("export.log", "export %s failed: %v", n, err)
		return "error"
	}
	writeLog("export.log", "exported %s", n)
	shellOpen(exportsDir)
	return "ok"
}

func main() {
	initPaths()
	startupLog("== %s v%s starting ==", appName, appVersion)
	startupLog("root: %s", rootDir)

	w := webview.NewWithOptions(webview.WebViewOptions{
		Debug:     false,
		DataPath:  filepath.Join(appDataDir, "webview"),
		AutoFocus: true,
		WindowOptions: webview.WindowOptions{
			Title:  appName,
			Width:  1280,
			Height: 820,
			Center: true,
		},
	})
	if w == nil {
		startupLog("WebView2 runtime not available")
		messageBox(
			"Couldn't start the display engine.\n\n"+
				appName+" uses Microsoft WebView2, which is built into Windows 10 and 11.\n"+
				"If this PC is missing it, install the free \"Evergreen WebView2 Runtime\" from Microsoft once, then reopen this program.",
			appName, mbOK|mbIconError)
		return
	}
	defer w.Destroy()
	w.SetSize(960, 640, webview.HintMin)

	w.Bind("appSaveProject", appSaveProject)
	w.Bind("appLoadProject", appLoadProject)
	w.Bind("appListProjects", appListProjects)
	w.Bind("appDeleteProject", appDeleteProject)
	w.Bind("appSaveSettings", appSaveSettings)
	w.Bind("appLoadSettings", appLoadSettings)
	w.Bind("appExport", appExport)
	w.Bind("appOpenFolder", func() { shellOpen(rootDir) })
	w.Bind("appLog", func(m string) { writeLog("app.log", "ui: %s", m) })

	w.SetHtml(appHTML)
	startupLog("window opened — running")
	w.Run()
	startupLog("closed")
}
