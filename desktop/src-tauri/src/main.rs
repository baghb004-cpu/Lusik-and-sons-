// ============================================================
// Lusik Builder desktop shell (Phase 16, plan §16/§16a)
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
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use tauri::{Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

const PORT: u16 = 4799;
const MIN_SPLASH_MS: u64 = 3400; // let the story reach the thumbs-up
const SERVER_TIMEOUT_S: u64 = 120;

fn session_token() -> String {
    // Random enough for a loopback session token: time + pid + ASLR noise.
    let t = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
    let p = std::process::id() as u128;
    let a = (&t as *const _ as usize) as u128;
    format!("lusik-desktop-{:032x}", t ^ (p << 64) ^ a.rotate_left(17))
}

/// USB layout, resolved relative to the exe:
///   builder.exe            (this shell)
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

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // 1. Splash first — the earliest visible surface there is.
            let splash = WebviewWindowBuilder::new(app, "splash", WebviewUrl::App("splash.html".into()))
                .title("Lusik Builder")
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

                let url = format!("http://127.0.0.1:{PORT}/builder#token={token}");
                let main = WebviewWindowBuilder::new(&handle, "main", WebviewUrl::External(url.parse().unwrap()))
                    .title("Lusik Builder")
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
        .expect("error while running the Lusik Builder shell");
}
