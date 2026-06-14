//go:build windows

// ============================================================
// Baghdo's Workshop — portable launcher (native Win32, pure Go stdlib)
// ============================================================
// One EXE. Black-box loading screen → simple main menu. No Node, no browser,
// no localhost, no install, no runtime. Fully portable: every path is relative
// to the EXE; the only writes are to ./app-data next to the EXE. Robust inside
// (startup log, missing-file checks, recovery screen), simple outside.
// ============================================================
package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"syscall"
	"time"
	"unsafe"
)

const (
	appName    = "Baghdo's Workshop"
	appVersion = "1.0.0"
	winW       = 760
	winH       = 540
)

type phase int

const (
	phaseLoading phase = iota
	phaseMenu
	phaseError
)

type button struct {
	label  string
	hint   string
	action func()
	r      rect
}

type appState struct {
	hwnd      syscall.Handle
	phase     phase
	step      int
	progress  float64
	statusMsg string
	errMsg    string

	exeDir, appData, resources, runtime, logPath string

	buttons []button
	hover   int

	// gdi resources (created once)
	bgBrush, panelBrush, accentBrush syscall.Handle
	hoverBrush                       syscall.Handle
	titleFont, bodyFont, smallFont   syscall.Handle
}

var st appState

var loadingSteps = []string{
	"Checking portable files…",
	"Loading local tools…",
	"Preparing your workspace…",
	"Starting workspace…",
}

func main() {
	pSetProcessDPIAware.Call()
	initPaths()
	logLine("== %s v%s starting ==", appName, appVersion)
	logLine("exe dir: %s", st.exeDir)

	hInst, _, _ := pGetModuleHandleW.Call(0)
	cursor, _, _ := pLoadCursorW.Call(0, idcArrow)

	st.bgBrush = solidBrush(rgb(12, 11, 10))       // near-black
	st.panelBrush = solidBrush(rgb(28, 25, 22))    // dark panel
	st.hoverBrush = solidBrush(rgb(44, 40, 35))    // hover
	st.accentBrush = solidBrush(rgb(200, 168, 90)) // warm gold
	st.titleFont = makeFont(-42, fwBold, "Segoe UI")
	st.bodyFont = makeFont(-20, fwNormal, "Segoe UI")
	st.smallFont = makeFont(-15, fwNormal, "Segoe UI")

	className := u16("BaghdoWorkshopLauncher")
	wc := wndClassExW{
		cbSize:        uint32(unsafe.Sizeof(wndClassExW{})),
		style:         0x0003, // CS_HREDRAW|CS_VREDRAW
		lpfnWndProc:   syscall.NewCallback(wndProc),
		hInstance:     syscall.Handle(hInst),
		hCursor:       syscall.Handle(cursor),
		hbrBackground: st.bgBrush,
		lpszClassName: className,
	}
	pRegisterClassExW.Call(uintptr(unsafe.Pointer(&wc)))

	cx, cy := sysMetric(smCXScreen), sysMetric(smCYScreen)
	x := (cx - winW) / 2
	y := (cy - winH) / 2
	style := uintptr(wsCaption | wsSysMenu | wsMinimizeBox | wsClipChildren | wsVisible)
	h, _, _ := pCreateWindowExW.Call(0,
		uintptr(unsafe.Pointer(className)),
		uintptr(unsafe.Pointer(u16(appName))),
		style,
		uintptr(x), uintptr(y), uintptr(winW), uintptr(winH),
		0, 0, hInst, 0)
	st.hwnd = syscall.Handle(h)

	checkFiles()
	pShowWindow.Call(uintptr(st.hwnd), swShow)
	pUpdateWindow.Call(uintptr(st.hwnd))

	st.statusMsg = loadingSteps[0]
	pSetTimer.Call(uintptr(st.hwnd), 1, 350, 0) // advance the loading screen

	var m msg
	for {
		r, _, _ := pGetMessageW.Call(uintptr(unsafe.Pointer(&m)), 0, 0, 0)
		if int32(r) <= 0 {
			break
		}
		pTranslateMessage.Call(uintptr(unsafe.Pointer(&m)))
		pDispatchMessageW.Call(uintptr(unsafe.Pointer(&m)))
	}
}

// --- portable paths + logging + checks (robust internals) ------------------

func initPaths() {
	buf := make([]uint16, 1024)
	n, _, _ := pGetModuleFileNameW.Call(0, uintptr(unsafe.Pointer(&buf[0])), uintptr(len(buf)))
	exe := syscall.UTF16ToString(buf[:n])
	st.exeDir = filepath.Dir(exe)
	st.appData = filepath.Join(st.exeDir, "app-data")
	st.resources = filepath.Join(st.exeDir, "resources")
	st.runtime = filepath.Join(st.exeDir, "runtime")
	_ = os.MkdirAll(filepath.Join(st.appData, "logs"), 0o755)
	st.logPath = filepath.Join(st.appData, "logs", "launch-"+time.Now().Format("20060102-150405")+".log")
}

func logLine(format string, a ...any) {
	f, err := os.OpenFile(st.logPath, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		return
	}
	defer f.Close()
	fmt.Fprintf(f, "%s  %s\n", time.Now().Format("15:04:05"), fmt.Sprintf(format, a...))
}

func checkFiles() {
	var missing []string
	// resources/ is optional in v1 but expected once tools ship
	if _, err := os.Stat(st.resources); err != nil {
		missing = append(missing, "resources/")
		_ = os.MkdirAll(st.resources, 0o755)
	}
	if len(missing) > 0 {
		logLine("created missing folders: %s", strings.Join(missing, ", "))
	} else {
		logLine("portable files OK")
	}
}

// --- window proc -----------------------------------------------------------

func wndProc(hwnd, message, wParam, lParam uintptr) uintptr {
	switch message {
	case wmEraseBkgnd:
		return 1 // we paint the background ourselves (no flicker)
	case wmTimer:
		onTimer()
		return 0
	case wmPaint:
		onPaint()
		return 0
	case wmMouseMove:
		onMouseMove(lo16(lParam), hi16(lParam))
		return 0
	case wmLButtonDown:
		onClick(lo16(lParam), hi16(lParam))
		return 0
	case wmClose, wmDestroy:
		pPostQuitMessage.Call(0)
		return 0
	}
	r, _, _ := pDefWindowProcW.Call(hwnd, message, wParam, lParam)
	return r
}

func repaint() { pInvalidateRect.Call(uintptr(st.hwnd), 0, 0) }

func onTimer() {
	if st.phase != phaseLoading {
		return
	}
	st.progress += 0.12
	idx := int(st.progress * float64(len(loadingSteps)))
	if idx >= len(loadingSteps) {
		idx = len(loadingSteps) - 1
	}
	if idx != st.step {
		st.step = idx
		st.statusMsg = loadingSteps[idx]
		logLine("loading: %s", st.statusMsg)
	}
	if st.progress >= 1.0 {
		st.progress = 1.0
		pKillTimer.Call(uintptr(st.hwnd), 1)
		buildMenu()
		st.phase = phaseMenu
		logLine("workspace ready — main menu shown")
	}
	repaint()
}

func clientRect() rect {
	var r rect
	pGetClientRect.Call(uintptr(st.hwnd), uintptr(unsafe.Pointer(&r)))
	return r
}

// --- painting --------------------------------------------------------------

func onPaint() {
	var ps paintStruct
	hdc, _, _ := pBeginPaint.Call(uintptr(st.hwnd), uintptr(unsafe.Pointer(&ps)))
	dc := syscall.Handle(hdc)
	cr := clientRect()
	fillRect(dc, &cr, st.bgBrush)
	pSetBkMode.Call(uintptr(dc), bkTransparent)

	switch st.phase {
	case phaseLoading:
		paintLoading(dc, cr)
	case phaseMenu:
		paintMenu(dc, cr)
	case phaseError:
		paintError(dc, cr)
	}
	pEndPaint.Call(uintptr(st.hwnd), uintptr(unsafe.Pointer(&ps)))
}

func paintLoading(dc syscall.Handle, cr rect) {
	w := cr.right - cr.left
	// title
	pSelectObject.Call(uintptr(dc), uintptr(st.titleFont))
	pSetTextColor.Call(uintptr(dc), rgb(245, 239, 227))
	tr := rect{0, cr.bottom/2 - 110, w, cr.bottom/2 - 40}
	drawText(dc, appName, &tr, dtCenter|dtSingleLine)
	// status
	pSelectObject.Call(uintptr(dc), uintptr(st.bodyFont))
	pSetTextColor.Call(uintptr(dc), rgb(176, 168, 150))
	sr := rect{0, cr.bottom/2 + 30, w, cr.bottom/2 + 70}
	drawText(dc, st.statusMsg, &sr, dtCenter|dtSingleLine)
	// progress bar
	barW := int32(360)
	bx := (w - barW) / 2
	by := cr.bottom/2 + 90
	track := rect{bx, by, bx + barW, by + 8}
	fillRect(dc, &track, st.panelBrush)
	fillW := int32(float64(barW) * st.progress)
	fillR := rect{bx, by, bx + fillW, by + 8}
	fillRect(dc, &fillR, st.accentBrush)
}

func paintMenu(dc syscall.Handle, cr rect) {
	w := cr.right - cr.left
	pSelectObject.Call(uintptr(dc), uintptr(st.titleFont))
	pSetTextColor.Call(uintptr(dc), rgb(245, 239, 227))
	tr := rect{0, 40, w, 110}
	drawText(dc, appName, &tr, dtCenter|dtSingleLine)
	pSelectObject.Call(uintptr(dc), uintptr(st.smallFont))
	pSetTextColor.Call(uintptr(dc), rgb(140, 132, 116))
	sub := rect{0, 110, w, 140}
	drawText(dc, "Portable workspace · runs offline from this drive", &sub, dtCenter|dtSingleLine)

	for i := range st.buttons {
		b := &st.buttons[i]
		br := b.r
		if i == st.hover {
			pSelectObject.Call(uintptr(dc), uintptr(st.hoverBrush))
		} else {
			pSelectObject.Call(uintptr(dc), uintptr(st.panelBrush))
		}
		pen, _, _ := pCreatePen.Call(psSolid, 1, rgb(64, 58, 50))
		oldPen, _, _ := pSelectObject.Call(uintptr(dc), pen)
		roundRect(dc, br.left, br.top, br.right, br.bottom, 16, 16)
		pSelectObject.Call(uintptr(dc), oldPen)
		pDeleteObject.Call(pen)

		pSelectObject.Call(uintptr(dc), uintptr(st.bodyFont))
		pSetTextColor.Call(uintptr(dc), rgb(238, 232, 220))
		lr := rect{br.left + 22, br.top, br.right - 22, br.top + 40}
		drawText(dc, b.label, &lr, dtLeft|dtVCenter|dtSingleLine)
		pSelectObject.Call(uintptr(dc), uintptr(st.smallFont))
		pSetTextColor.Call(uintptr(dc), rgb(150, 142, 126))
		hr := rect{br.left + 22, br.top + 34, br.right - 22, br.bottom - 6}
		drawText(dc, b.hint, &hr, dtLeft|dtSingleLine)
	}
}

func paintError(dc syscall.Handle, cr rect) {
	w := cr.right - cr.left
	pSelectObject.Call(uintptr(dc), uintptr(st.titleFont))
	pSetTextColor.Call(uintptr(dc), rgb(240, 120, 110))
	tr := rect{0, 60, w, 130}
	drawText(dc, "Can't start", &tr, dtCenter|dtSingleLine)
	pSelectObject.Call(uintptr(dc), uintptr(st.bodyFont))
	pSetTextColor.Call(uintptr(dc), rgb(210, 202, 188))
	mr := rect{40, 150, w - 40, cr.bottom - 40}
	drawText(dc, st.errMsg, &mr, dtCenter|dtWordBreak)
}

// --- menu --------------------------------------------------------------

func buildMenu() {
	st.hover = -1
	st.buttons = []button{
		{label: "Open my files", hint: "Your saved work (app-data)", action: func() { shellOpen(st.appData) }},
		{label: "Open tools folder", hint: "Bundled local tools & resources", action: func() { shellOpen(st.resources) }},
		{label: "View startup log", hint: "What happened when this opened", action: func() { shellOpen(st.logPath) }},
		{label: "About", hint: "Version & offline info", action: aboutBox},
		{label: "Quit", hint: "Close the workspace", action: func() { pDestroyWindow.Call(uintptr(st.hwnd)) }},
	}
	layoutMenu()
}

func layoutMenu() {
	cr := clientRect()
	w := cr.right - cr.left
	bw := int32(440)
	if bw > w-80 {
		bw = w - 80
	}
	bx := (w - bw) / 2
	by := int32(170)
	bh := int32(60)
	gap := int32(14)
	for i := range st.buttons {
		st.buttons[i].r = rect{bx, by, bx + bw, by + bh}
		by += bh + gap
	}
}

func hitTest(x, y int32) int {
	for i := range st.buttons {
		r := st.buttons[i].r
		if x >= r.left && x <= r.right && y >= r.top && y <= r.bottom {
			return i
		}
	}
	return -1
}

func onMouseMove(x, y int32) {
	if st.phase != phaseMenu {
		return
	}
	h := hitTest(x, y)
	if h != st.hover {
		st.hover = h
		repaint()
	}
}

func onClick(x, y int32) {
	if st.phase != phaseMenu {
		return
	}
	if i := hitTest(x, y); i >= 0 && st.buttons[i].action != nil {
		logLine("menu: %s", st.buttons[i].label)
		st.buttons[i].action()
	}
}

func aboutBox() {
	messageBox(
		appName+"  v"+appVersion+"\n\n"+
			"A portable workspace that runs from this drive.\n"+
			"100% offline. No internet, no install, no setup.\n\n"+
			"Your files live in the app-data folder next to this program.",
		"About "+appName, mbOK|mbIconInformation)
}
