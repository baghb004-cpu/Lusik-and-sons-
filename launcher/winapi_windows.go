//go:build windows

// ============================================================
// Baghdo's Workshop — native Win32 bindings (pure stdlib, no cgo)
// ============================================================
// Thin syscall layer over user32/gdi32/kernel32/shell32 so the launcher is a
// real native desktop app: no Node, no .NET, no WebView, no browser, no install.
// Cross-compiles from any OS with: GOOS=windows GOARCH=amd64 go build.
// ============================================================
package main

import (
	"syscall"
	"unsafe"
)

var (
	user32   = syscall.NewLazyDLL("user32.dll")
	gdi32    = syscall.NewLazyDLL("gdi32.dll")
	kernel32 = syscall.NewLazyDLL("kernel32.dll")
	shell32  = syscall.NewLazyDLL("shell32.dll")

	pRegisterClassExW   = user32.NewProc("RegisterClassExW")
	pCreateWindowExW    = user32.NewProc("CreateWindowExW")
	pDefWindowProcW     = user32.NewProc("DefWindowProcW")
	pShowWindow         = user32.NewProc("ShowWindow")
	pUpdateWindow       = user32.NewProc("UpdateWindow")
	pGetMessageW        = user32.NewProc("GetMessageW")
	pTranslateMessage   = user32.NewProc("TranslateMessage")
	pDispatchMessageW   = user32.NewProc("DispatchMessageW")
	pPostQuitMessage    = user32.NewProc("PostQuitMessage")
	pDestroyWindow      = user32.NewProc("DestroyWindow")
	pBeginPaint         = user32.NewProc("BeginPaint")
	pEndPaint           = user32.NewProc("EndPaint")
	pInvalidateRect     = user32.NewProc("InvalidateRect")
	pGetClientRect      = user32.NewProc("GetClientRect")
	pFillRect           = user32.NewProc("FillRect")
	pSetTimer           = user32.NewProc("SetTimer")
	pKillTimer          = user32.NewProc("KillTimer")
	pLoadCursorW        = user32.NewProc("LoadCursorW")
	pSetCursor          = user32.NewProc("SetCursor")
	pDrawTextW          = user32.NewProc("DrawTextW")
	pMessageBoxW        = user32.NewProc("MessageBoxW")
	pGetSystemMetrics   = user32.NewProc("GetSystemMetrics")
	pSetProcessDPIAware = user32.NewProc("SetProcessDPIAware")

	pCreateSolidBrush = gdi32.NewProc("CreateSolidBrush")
	pCreateFontW      = gdi32.NewProc("CreateFontW")
	pSelectObject     = gdi32.NewProc("SelectObject")
	pSetTextColor     = gdi32.NewProc("SetTextColor")
	pSetBkMode        = gdi32.NewProc("SetBkMode")
	pRoundRect        = gdi32.NewProc("RoundRect")
	pCreatePen        = gdi32.NewProc("CreatePen")
	pDeleteObject     = gdi32.NewProc("DeleteObject")

	pGetModuleHandleW   = kernel32.NewProc("GetModuleHandleW")
	pGetModuleFileNameW = kernel32.NewProc("GetModuleFileNameW")

	pShellExecuteW = shell32.NewProc("ShellExecuteW")
)

const (
	wsOverlapped       = 0x00000000
	wsCaption          = 0x00C00000
	wsSysMenu          = 0x00080000
	wsMinimizeBox      = 0x00020000
	wsClipChildren     = 0x02000000
	wsVisible          = 0x10000000
	cwUseDefault       = ^uintptr(0) - 0x7FFFFFFF // 0x80000000
	swShow             = 5
	swShowNormal       = 1
	wmDestroy          = 0x0002
	wmClose            = 0x0010
	wmPaint            = 0x000F
	wmTimer            = 0x0113
	wmLButtonDown      = 0x0201
	wmMouseMove        = 0x0200
	wmEraseBkgnd       = 0x0014
	wmSize             = 0x0005
	wmSetCursor        = 0x0020
	idcArrow           = 32512
	idcHand            = 32649
	dtCenter           = 0x00000001
	dtVCenter          = 0x00000004
	dtSingleLine       = 0x00000020
	dtWordBreak        = 0x00000010
	dtLeft             = 0x00000000
	bkTransparent      = 1
	fwNormal           = 400
	fwBold             = 700
	fwSemiBold         = 600
	mbOK               = 0x00000000
	mbIconInformation  = 0x00000040
	mbIconError        = 0x00000010
	smCXScreen         = 0
	smCYScreen         = 1
	psSolid            = 0
	defaultCharset     = 1
	clearTypeQuality   = 5
	variablePitch      = 2
	fontFamilySwiss    = 0x20
)

type rect struct{ left, top, right, bottom int32 }
type point struct{ x, y int32 }

type wndClassExW struct {
	cbSize        uint32
	style         uint32
	lpfnWndProc   uintptr
	cbClsExtra    int32
	cbWndExtra    int32
	hInstance     syscall.Handle
	hIcon         syscall.Handle
	hCursor       syscall.Handle
	hbrBackground syscall.Handle
	lpszMenuName  *uint16
	lpszClassName *uint16
	hIconSm       syscall.Handle
}

type msg struct {
	hwnd     syscall.Handle
	message  uint32
	wParam   uintptr
	lParam   uintptr
	time     uint32
	pt       point
	lPrivate uint32
}

type paintStruct struct {
	hdc         syscall.Handle
	fErase      int32
	rcPaint     rect
	fRestore    int32
	fIncUpdate  int32
	rgbReserved [32]byte
}

func u16(s string) *uint16 { p, _ := syscall.UTF16PtrFromString(s); return p }
func rgb(r, g, b uint32) uintptr { return uintptr(b<<16 | g<<8 | r) }
func lo16(v uintptr) int32 { return int32(int16(v & 0xFFFF)) }
func hi16(v uintptr) int32 { return int32(int16((v >> 16) & 0xFFFF)) }

func solidBrush(c uintptr) syscall.Handle { h, _, _ := pCreateSolidBrush.Call(c); return syscall.Handle(h) }
func makeFont(height int32, weight uintptr, face string) syscall.Handle {
	h, _, _ := pCreateFontW.Call(uintptr(height), 0, 0, 0, weight, 0, 0, 0,
		defaultCharset, 0, 0, clearTypeQuality, variablePitch|fontFamilySwiss, uintptr(unsafe.Pointer(u16(face))))
	return syscall.Handle(h)
}
func fillRect(hdc syscall.Handle, r *rect, br syscall.Handle) {
	pFillRect.Call(uintptr(hdc), uintptr(unsafe.Pointer(r)), uintptr(br))
}
func drawText(hdc syscall.Handle, s string, r *rect, flags uintptr) {
	pDrawTextW.Call(uintptr(hdc), uintptr(unsafe.Pointer(u16(s))), ^uintptr(0), uintptr(unsafe.Pointer(r)), flags)
}
func roundRect(hdc syscall.Handle, l, t, rr, b, ew, eh int32) {
	pRoundRect.Call(uintptr(hdc), uintptr(l), uintptr(t), uintptr(rr), uintptr(b), uintptr(ew), uintptr(eh))
}
func sysMetric(i uintptr) int32 { v, _, _ := pGetSystemMetrics.Call(i); return int32(v) }
func messageBox(text, caption string, flags uintptr) {
	pMessageBoxW.Call(0, uintptr(unsafe.Pointer(u16(text))), uintptr(unsafe.Pointer(u16(caption))), flags)
}
func shellOpen(path string) {
	pShellExecuteW.Call(0, uintptr(unsafe.Pointer(u16("open"))), uintptr(unsafe.Pointer(u16(path))), 0, 0, swShowNormal)
}
