// ============================================================
// Baghdo's Workshop desktop shell (Phase 16, plan §16/§16a)
// ============================================================
// The startup choreography:
//   1. IMMEDIATELY open the splash window (the §16a mini-story —
//      a local HTML file, visible within ~100ms of launch).
//   2. In the background, spawn the builder server: the portable
//      Node runtime + the app folder sitting next to the exe
//      (USB layout, see ../README.md), with a fresh random
//      BUILDER_LOCAL_TOKEN for this session.
//   3. Poll the port until the server answers. Respect the
//      story: never cut the splash before MIN_SPLASH_MS.
//   4. Emit "app-ready" (splash fades), open the main window at
//      /builder#token=… (the shell logs the operator in), close
//      the splash. If the server dies instead, the splash shows
//      the error — honest, not hung.
// ============================================================

use std::net::TcpStream;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::time::{Duration, Instant};

use tauri::{Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

const PORT: u16 = 4799;
const MIN_SPLASH_MS: u64 = 3400; // let the story reach the thumbs-up
const SERVER_TIMEOUT_S: u64 = 120;

fn session_token() -> String {
    // Cryptographically random — this token is the ONLY gate on a local
    // server that reads/writes files on disk, so it must not be guessable
    // (a local process or a DNS-rebinding page could otherwise brute it).
    // 32 bytes from the OS CSPRNG → 64 hex chars.
    let mut bytes = [0u8; 32];
    getrandom::fill(&mut bytes).expect("OS RNG unavailable");
    let hex: String = bytes.iter().map(|b| format!("{b:02x}")).collect();
    format!("baghdo-desktop-{hex}")
}

/// USB layout, resolved relative to the exe:
///   baghdos-workshop.exe   (this shell)
///   node/node.exe          (portable Node runtime)
///   app/                   (the builder project — package.json etc.)
fn portable_paths() -> Option<(PathBuf, PathBuf)> {
    let exe = std::env::current_exe().ok()?;
    let root = exe.parent()?;
    let node = root.join("node").join(if cfg!(windows) { "node.exe" } else { "node" });
    let app = root.join("app");
    if node.exists() && app.join("package.json").exists() {
        Some((node, app))
    } else {
        None
    }
}

fn spawn_server(token: &str) -> Result<Option<Child>, String> {
    // Dev convenience: BUILDER_EXTERNAL=1 means "a server is already
    // running" (e.g. `npm run next:dev`) — the shell just connects.
    if std::env::var("BUILDER_EXTERNAL").as_deref() == Ok("1") {
        return Ok(None);
    }
    let (node, app) = portable_paths().ok_or_else(|| {
        "Portable layout not found: expected node/ and app/ next to the executable (see README — run the make-portable script), or set BUILDER_EXTERNAL=1 with a dev server running.".to_string()
    })?;
    let next_bin = app.join("node_modules").join("next").join("dist").join("bin").join("next");
    Command::new(&node)
        .arg(next_bin)
        .arg("start")
        .arg("-p")
        .arg(PORT.to_string())
        .current_dir(&app)
        .env("BUILDER_LOCAL_TOKEN", token)
        .env("NODE_ENV", "production")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map(Some)
        .map_err(|e| format!("Could not start the builder server: {e}"))
}

fn wait_for_port(deadline: Instant) -> bool {
    while Instant::now() < deadline {
        if TcpStream::connect_timeout(
            &std::net::SocketAddr::from(([127, 0, 0, 1], PORT)),
            Duration::from_millis(400),
        )
        .is_ok()
        {
            // Port open → give Next a beat to finish booting routes.
            std::thread::sleep(Duration::from_millis(700));
            return true;
        }
        std::thread::sleep(Duration::from_millis(250));
    }
    false
}

// ── Game Mode (plan §23): the optional Godot companion ──────
// Lives at game-mode/godot-export/ next to the exe. Missing = the
// launcher says so kindly and Normal Mode proceeds — Game Mode can
// never take the builder down (separate process, same API token).
fn find_game_mode() -> Option<PathBuf> {
    let exe = std::env::current_exe().ok()?;
    let dir = exe.parent()?.join("game-mode").join("godot-export");
    let entries = std::fs::read_dir(&dir).ok()?;
    for entry in entries.flatten() {
        let path = entry.path();
        let name = path.file_name()?.to_string_lossy().to_lowercase();
        if cfg!(windows) && name.ends_with(".exe") {
            return Some(path);
        }
        if !cfg!(windows) && (name.ends_with(".x86_64") || name.ends_with(".app")) {
            return Some(path);
        }
    }
    None
}

static TOKEN: std::sync::OnceLock<String> = std::sync::OnceLock::new();
// The splash's "🎮 Game Mode" toggle — checked once the server is ready.
static WANT_GAME_MODE: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

fn spawn_game_mode() -> Result<(), String> {
    let bin = find_game_mode().ok_or_else(|| {
        "Game Mode isn't installed yet: open desktop/game-mode/godot-project in Godot 4.3+, export for Windows, and drop the exe into game-mode/godot-export/.".to_string()
    })?;
    let token = TOKEN.get().cloned().unwrap_or_default();
    Command::new(&bin)
        .env("WORKSHOP_TOKEN", token)
        .env("WORKSHOP_PORT", PORT.to_string())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("Game Mode could not start: {e}"))
}

#[tauri::command]
fn game_mode_available() -> bool {
    find_game_mode().is_some()
}

#[tauri::command]
fn enter_game_mode() -> Result<(), String> {
    spawn_game_mode()
}

#[tauri::command]
fn request_game_mode(enabled: bool) {
    WANT_GAME_MODE.store(enabled, std::sync::atomic::Ordering::Relaxed);
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![game_mode_available, enter_game_mode, request_game_mode])
        .setup(|app| {
            // 1. Splash first — the earliest visible surface there is.
            let splash = WebviewWindowBuilder::new(app, "splash", WebviewUrl::App("splash.html".into()))
                .title("Baghdo's Workshop")
                .inner_size(480.0, 340.0)
                .decorations(false)
                .resizable(false)
                .transparent(true)
                .center()
                .build()?;

            let handle = app.handle().clone();
            std::thread::spawn(move || {
                let started = Instant::now();
                let token = session_token();
                let _ = TOKEN.set(token.clone());
                let mut child = match spawn_server(&token) {
                    Ok(c) => c,
                    Err(msg) => {
                        let _ = splash.emit("app-error", &msg);
                        return;
                    }
                };

                let ready = wait_for_port(started + Duration::from_secs(SERVER_TIMEOUT_S));

                // Respect the story — never cut the splash early.
                let elapsed = started.elapsed().as_millis() as u64;
                if elapsed < MIN_SPLASH_MS {
                    std::thread::sleep(Duration::from_millis(MIN_SPLASH_MS - elapsed));
                }

                if !ready {
                    let _ = splash.emit("app-error", "The builder server didn't start in time.");
                    if let Some(c) = child.as_mut() {
                        let _ = c.kill();
                    }
                    return;
                }

                let _ = splash.emit("app-ready", ());
                std::thread::sleep(Duration::from_millis(550)); // the fade

                // Opt-in Game Mode at launch: --game-mode flag or env. The
                // builder window opens either way — the engine is the product.
                let wants_game = std::env::args().any(|a| a == "--game-mode")
                    || std::env::var("WORKSHOP_GAME_MODE").as_deref() == Ok("1")
                    || WANT_GAME_MODE.load(std::sync::atomic::Ordering::Relaxed);
                if wants_game {
                    let _ = spawn_game_mode(); // missing → silent here; the splash button explains
                }

                let url = format!("http://127.0.0.1:{PORT}/builder#token={token}");
                let main = WebviewWindowBuilder::new(&handle, "main", WebviewUrl::External(url.parse().unwrap()))
                    .title("Baghdo's Workshop")
                    .inner_size(1320.0, 860.0)
                    .min_inner_size(900.0, 600.0)
                    .center()
                    .build();
                let _ = splash.close();

                // When the main window closes, take the server down with us.
                if let (Ok(window), Some(mut c)) = (main, child.take()) {
                    window.on_window_event(move |event| {
                        if matches!(event, tauri::WindowEvent::Destroyed) {
                            let _ = c.kill();
                        }
                    });
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running the Baghdo's Workshop shell");
}
