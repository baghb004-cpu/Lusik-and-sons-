//go:build windows

// ============================================================
// Baghdo's Workshop — portable app (single self-contained EXE)
// ============================================================
// One EXE. Opens a clean app window (embedded WebView2 — an OS component, NOT a
// browser the user opens, NO localhost, NO Node) showing the bundled UI with a
// real-time live preview. The whole UI is embedded in the EXE; the only writes
// are to ./app-data next to the EXE (saved projects, exports, logs).
// Cross-compiles from any OS: GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build.
// ============================================================
package main

import (
	_ "embed"
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
	appVersion = "1.0.0"
)

var (
	exeDir, appDataDir, resourcesDir, logPath string
)

func initPaths() {
	exe, err := os.Executable()
	if err != nil {
		exe, _ = filepath.Abs(os.Args[0])
	}
	exeDir = filepath.Dir(exe)
	appDataDir = filepath.Join(exeDir, "app-data")
	resourcesDir = filepath.Join(exeDir, "resources")
	_ = os.MkdirAll(filepath.Join(appDataDir, "logs"), 0o755)
	_ = os.MkdirAll(filepath.Join(appDataDir, "exports"), 0o755)
	_ = os.MkdirAll(resourcesDir, 0o755)
	logPath = filepath.Join(appDataDir, "logs", "launch-"+time.Now().Format("20060102-150405")+".log")
}

func logLine(format string, a ...any) {
	f, err := os.OpenFile(logPath, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		return
	}
	defer f.Close()
	fmt.Fprintf(f, "%s  %s\n", time.Now().Format("15:04:05"), fmt.Sprintf(format, a...))
}

// --- functions the UI can call (no server; these run in-process) -----------

func saveData(name, content string) string {
	safe := filepath.Base(name)
	if err := os.WriteFile(filepath.Join(appDataDir, safe+".json"), []byte(content), 0o644); err != nil {
		logLine("save %s failed: %v", safe, err)
		return "error"
	}
	logLine("saved %s (%d bytes)", safe, len(content))
	return "ok"
}

func loadData(name string) string {
	safe := filepath.Base(name)
	b, err := os.ReadFile(filepath.Join(appDataDir, safe+".json"))
	if err != nil {
		return ""
	}
	return string(b)
}

func exportFile(name, html string) string {
	safe := filepath.Base(name)
	if safe == "" || safe == "." {
		safe = "page.html"
	}
	dir := filepath.Join(appDataDir, "exports")
	if err := os.WriteFile(filepath.Join(dir, safe), []byte(html), 0o644); err != nil {
		logLine("export failed: %v", err)
		return "error"
	}
	logLine("exported %s", safe)
	shellOpen(dir)
	return "ok"
}

func main() {
	initPaths()
	logLine("== %s v%s starting ==", appName, appVersion)
	logLine("exe dir: %s", exeDir)

	w := webview.NewWithOptions(webview.WebViewOptions{
		Debug:     false,
		DataPath:  filepath.Join(appDataDir, "webview"),
		AutoFocus: true,
		WindowOptions: webview.WindowOptions{
			Title:  appName,
			Width:  1180,
			Height: 780,
			Center: true,
		},
	})
	if w == nil {
		logLine("WebView2 runtime not available")
		messageBox(
			"Couldn't start the display engine.\n\n"+
				appName+" uses Microsoft WebView2, which is built into Windows 10 and 11.\n"+
				"If this PC is missing it, install the free \"Evergreen WebView2 Runtime\" from Microsoft once, then reopen this program.",
			appName, mbOK|mbIconError)
		return
	}
	defer w.Destroy()
	w.SetSize(860, 600, webview.HintMin)

	// expose local, in-process functions to the UI (no network, no server)
	w.Bind("appSave", saveData)
	w.Bind("appLoad", loadData)
	w.Bind("appExport", exportFile)
	w.Bind("appOpenFolder", func() { shellOpen(appDataDir) })
	w.Bind("appLog", func(m string) { logLine("ui: %s", m) })

	w.SetHtml(appHTML)
	logLine("window opened — running")
	w.Run()
	logLine("closed")
}
