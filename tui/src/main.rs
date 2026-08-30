use crossterm::{
    event::{self, DisableMouseCapture, EnableMouseCapture, Event, KeyCode, KeyEvent, KeyModifiers},
    execute,
    terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen},
};
use ratatui::{
    backend::CrosstermBackend,
    layout::{Constraint, Direction, Layout, Rect},
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Borders, List, ListItem, ListState, Paragraph, Wrap},
    Frame, Terminal,
};
use serde::{Deserialize, Serialize};
use std::{
    io,
    process::Stdio,
    time::{Duration, Instant},
};
use tokio::sync::mpsc;
use tokio::process::Command;

// ─── SEO Report Structs ───────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SEOCheckResult {
    pub passed: bool,
    pub message: String,
    pub severity: Option<String>,
    pub details: Option<serde_json::Value>,
    /// Stable rule identifier (e.g. "title-exists"). Not yet populated by
    /// every checker — see SEOCheckResult in src/types/index.ts.
    pub name: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SEOReportSummary {
    pub total: usize,
    pub passed: usize,
    pub failed: usize,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SEOReportChecks {
    #[serde(rename = "metaTags")]
    pub meta_tags: Option<Vec<SEOCheckResult>>,
    pub headings: Option<Vec<SEOCheckResult>>,
    pub images: Option<Vec<SEOCheckResult>>,
    pub performance: Option<Vec<SEOCheckResult>>,
    #[serde(rename = "robotsTxt")]
    pub robots_txt: Option<Vec<SEOCheckResult>>,
    pub sitemap: Option<Vec<SEOCheckResult>>,
    pub security: Option<Vec<SEOCheckResult>>,
    #[serde(rename = "structuredData")]
    pub structured_data: Option<Vec<SEOCheckResult>>,
    #[serde(rename = "socialMedia")]
    pub social_media: Option<Vec<SEOCheckResult>>,
    pub content: Option<Vec<SEOCheckResult>>,
    pub links: Option<Vec<SEOCheckResult>>,
    #[serde(rename = "uiElements")]
    pub ui_elements: Option<Vec<SEOCheckResult>>,
    pub technical: Option<Vec<SEOCheckResult>>,
    pub accessibility: Option<Vec<SEOCheckResult>>,
    #[serde(rename = "urlFactors")]
    pub url_factors: Option<Vec<SEOCheckResult>>,
    #[serde(rename = "spamDetection")]
    pub spam_detection: Option<Vec<SEOCheckResult>>,
    #[serde(rename = "pageQuality")]
    pub page_quality: Option<Vec<SEOCheckResult>>,
    #[serde(rename = "advancedImages")]
    pub advanced_images: Option<Vec<SEOCheckResult>>,
    pub multimedia: Option<Vec<SEOCheckResult>>,
    #[serde(rename = "coreWebVitals")]
    pub core_web_vitals: Option<Vec<SEOCheckResult>>,
    pub analytics: Option<Vec<SEOCheckResult>>,
    #[serde(rename = "mobileUX")]
    pub mobile_ux: Option<Vec<SEOCheckResult>>,
    #[serde(rename = "schemaValidation")]
    pub schema_validation: Option<Vec<SEOCheckResult>>,
    #[serde(rename = "resourceOptimization")]
    pub resource_optimization: Option<Vec<SEOCheckResult>>,
    #[serde(rename = "legalCompliance")]
    pub legal_compliance: Option<Vec<SEOCheckResult>>,
    pub ecommerce: Option<Vec<SEOCheckResult>>,
    pub internationalization: Option<Vec<SEOCheckResult>>,
    pub heatmap: Option<Vec<SEOCheckResult>>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SEOReport {
    pub url: String,
    /// `null` in the JSON when the audit checked nothing (see
    /// calculateWeightedScore in src/scoring.ts) — not a magic 0 or 100.
    pub score: Option<usize>,
    pub timestamp: String,
    pub summary: SEOReportSummary,
    pub checks: SEOReportChecks,
    /// Set by the `aviary-fast` binary's report shape (engine/src/bin/aviary_fast.rs);
    /// absent (defaults false) for a `node dist/cli.js --json` report.
    #[serde(default)]
    pub fast: bool,
    #[serde(default, rename = "fastCategories")]
    pub fast_categories: Vec<String>,
}

// ─── Channel Events ───────────────────────────────────────────────────────────


enum AuditEvent {
    StatusUpdate(String),
    Complete(Box<SEOReport>),
    Error(String),
}

// ─── App State ────────────────────────────────────────────────────────────────

#[derive(PartialEq)]
enum ActiveScreen {
    Setup,
    Loading,
    Dashboard,
    Error(String),
}

#[derive(PartialEq, Clone)]
enum SetupField {
    Url,
    Preset,
    FastMode,
    HtmlReport,
}

// Severity filter for dashboard checks panel
#[derive(PartialEq, Clone)]
enum SeverityFilter {
    All,
    ErrorsOnly,
    WarningsOnly,
}

struct App {
    active_screen: ActiveScreen,
    cli_path: String,
    fast_bin_path: String,

    // Setup fields
    url_input: String,
    preset_index: usize, // 0=Basic, 1=Advanced, 2=Strict
    fast_mode: bool,
    html_report_path: String,
    selected_setup_field: SetupField,

    // Loading status
    loading_status: String,

    // Report data
    report: Option<SEOReport>,
    categories: Vec<(String, Vec<SEOCheckResult>)>,
    category_list_state: ListState,
    check_list_state: ListState,
    active_panel_right: bool,

    // Severity filter
    severity_filter: SeverityFilter,
}

impl App {
    fn new(cli_path: String, fast_bin_path: String) -> App {
        let mut app = App {
            active_screen: ActiveScreen::Setup,
            cli_path,
            fast_bin_path,
            url_input: "https://".to_string(),
            preset_index: 1,
            fast_mode: false,
            html_report_path: "seo-report.html".to_string(),
            selected_setup_field: SetupField::Url,
            loading_status: String::new(),
            report: None,
            categories: Vec::new(),
            category_list_state: ListState::default(),
            check_list_state: ListState::default(),
            active_panel_right: false,
            severity_filter: SeverityFilter::All,
        };
        app.category_list_state.select(Some(0));
        app.check_list_state.select(Some(0));
        app
    }

    fn populate_categories(&mut self) {
        if let Some(r) = &self.report {
            let mut cats = Vec::new();
            let c = &r.checks;

            let mut add = |name: &str, checks: &Option<Vec<SEOCheckResult>>| {
                if let Some(lst) = checks {
                    if !lst.is_empty() {
                        cats.push((name.to_string(), lst.clone()));
                    }
                }
            };

            add("META TAGS", &c.meta_tags);
            add("HEADINGS", &c.headings);
            add("IMAGES", &c.images);
            add("PERFORMANCE", &c.performance);
            add("ROBOTS.TXT", &c.robots_txt);
            add("SITEMAP", &c.sitemap);
            add("SECURITY", &c.security);
            add("STRUCTURED DATA", &c.structured_data);
            add("SOCIAL MEDIA", &c.social_media);
            add("CONTENT", &c.content);
            add("LINKS", &c.links);
            add("UI ELEMENTS", &c.ui_elements);
            add("TECHNICAL SEO", &c.technical);
            add("ACCESSIBILITY", &c.accessibility);
            add("URL FACTORS", &c.url_factors);
            add("SPAM DETECTION", &c.spam_detection);
            add("PAGE QUALITY", &c.page_quality);
            add("ADVANCED IMAGES", &c.advanced_images);
            add("MULTIMEDIA", &c.multimedia);
            add("RESOURCE PERFORMANCE", &c.core_web_vitals);
            add("ANALYTICS", &c.analytics);
            add("MOBILE UX", &c.mobile_ux);
            add("SCHEMA VALIDATION", &c.schema_validation);
            add("RESOURCE OPTIMIZATION", &c.resource_optimization);
            add("LEGAL & COMPLIANCE", &c.legal_compliance);
            add("E-COMMERCE", &c.ecommerce);
            add("INTERNATIONALIZATION", &c.internationalization);
            add("HEATMAP & UX", &c.heatmap);

            self.categories = cats;
            self.category_list_state.select(Some(0));
            self.check_list_state.select(Some(0));
        }
    }

    fn get_grade(&self) -> &str {
        let Some(report) = &self.report else {
            return "";
        };
        match report.score {
            Some(score) if score >= 90 => "A",
            Some(score) if score >= 80 => "B",
            Some(score) if score >= 70 => "C",
            Some(score) if score >= 60 => "D",
            Some(_) => "F",
            None => "N/A",
        }
    }

    fn filtered_checks<'a>(&self, checks: &'a [SEOCheckResult]) -> Vec<&'a SEOCheckResult> {
        match &self.severity_filter {
            SeverityFilter::All => checks.iter().collect(),
            SeverityFilter::ErrorsOnly => checks
                .iter()
                .filter(|c| {
                    !c.passed
                        && c.severity
                            .as_deref()
                            .map(|s| s == "error")
                            .unwrap_or(false)
                })
                .collect(),
            SeverityFilter::WarningsOnly => checks
                .iter()
                .filter(|c| {
                    !c.passed
                        && c.severity
                            .as_deref()
                            .map(|s| s == "warning")
                            .unwrap_or(false)
                })
                .collect(),
        }
    }
}

// ─── Colors (Brutalist Palette) ───────────────────────────────────────────────

const BG: Color = Color::Rgb(13, 13, 13);
const FG: Color = Color::Rgb(240, 240, 240);
const RED: Color = Color::Rgb(255, 59, 48);
const GREEN: Color = Color::Rgb(0, 255, 65);
const YELLOW: Color = Color::Rgb(255, 200, 0);
const DIM: Color = Color::Rgb(60, 60, 60);
const MID: Color = Color::Rgb(120, 120, 120);

// ─── Main ─────────────────────────────────────────────────────────────────────

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Parse CLI args to find --cli-path / --fast-bin
    let mut cli_path: Option<String> = None;
    let mut fast_bin_path: Option<String> = None;
    let args: Vec<String> = std::env::args().collect();
    for i in 0..args.len() {
        if args[i] == "--cli-path" && i + 1 < args.len() {
            cli_path = Some(args[i + 1].clone());
        }
        if args[i] == "--fast-bin" && i + 1 < args.len() {
            fast_bin_path = Some(args[i + 1].clone());
        }
    }

    // Resolve cli_path: explicit arg > next to binary > CWD fallback
    let cli_path = cli_path.unwrap_or_else(|| {
        if let Ok(exe) = std::env::current_exe() {
            if let Some(exe_dir) = exe.parent() {
                let candidate = exe_dir.join("cli.js");
                if candidate.exists() {
                    return candidate.to_string_lossy().into_owned();
                }
            }
        }
        "dist/cli.js".to_string()
    });

    // Resolve fast_bin_path: explicit arg > next to this binary (a workspace
    // build puts both `tui` and `aviary-fast` in the same target/<profile>/
    // directory) > bare name, relying on PATH.
    let fast_bin_path = fast_bin_path.unwrap_or_else(|| {
        if let Ok(exe) = std::env::current_exe() {
            if let Some(exe_dir) = exe.parent() {
                let candidate = exe_dir.join("aviary-fast");
                if candidate.exists() {
                    return candidate.to_string_lossy().into_owned();
                }
            }
        }
        "aviary-fast".to_string()
    });

    // Terminal setup
    enable_raw_mode()?;
    let mut stdout = io::stdout();
    execute!(stdout, EnterAlternateScreen, EnableMouseCapture)?;
    let backend = CrosstermBackend::new(stdout);
    let mut terminal = Terminal::new(backend)?;

    // Audit event channel — background task → main loop
    let (audit_tx, audit_rx) = mpsc::channel::<AuditEvent>(32);

    let app = App::new(cli_path, fast_bin_path);

    let run_result = run_loop(&mut terminal, app, audit_tx, audit_rx).await;


    // Restore terminal
    disable_raw_mode()?;
    execute!(
        terminal.backend_mut(),
        LeaveAlternateScreen,
        DisableMouseCapture
    )?;
    terminal.show_cursor()?;

    if let Err(err) = run_result {
        eprintln!("TUI Error: {}", err);
    }

    Ok(())
}

// ─── Main Event Loop ──────────────────────────────────────────────────────────

async fn run_loop<B: ratatui::backend::Backend>(
    terminal: &mut Terminal<B>,
    mut app: App,
    audit_tx: mpsc::Sender<AuditEvent>,
    mut audit_rx: mpsc::Receiver<AuditEvent>,
) -> io::Result<()> {
    let mut spinner_frame: usize = 0;
    let mut load_start: Option<Instant> = None;
    let mut elapsed_secs: u64 = 0;

    let tick_rate = Duration::from_millis(16); // 60 fps
    let mut last_tick = Instant::now();

    loop {
        // Calculate elapsed if loading
        if let Some(start) = load_start {
            elapsed_secs = start.elapsed().as_secs();
        }

        // Render frame
        terminal.draw(|f| draw_ui(f, &app, spinner_frame, elapsed_secs))?;

        let timeout = tick_rate
            .checked_sub(last_tick.elapsed())
            .unwrap_or_else(|| Duration::from_secs(0));

        // Poll for UI input with exact remaining time for 16ms frame (~60fps)
        if event::poll(timeout)? {
            if let Event::Key(key) = event::read()? {
                // Global: Ctrl-C → quit
                if key.code == KeyCode::Char('c')
                    && key.modifiers.contains(KeyModifiers::CONTROL)
                {
                    break;
                }

                let should_quit = handle_input(&mut app, key, &audit_tx).await;
                if should_quit {
                    break;
                }

                // Start elapsed timer when entering Loading screen
                if matches!(app.active_screen, ActiveScreen::Loading) {
                    if load_start.is_none() {
                        load_start = Some(Instant::now());
                    }
                } else {
                    load_start = None;
                }
            }
        }

        if last_tick.elapsed() >= tick_rate {
            // Advance spinner every tick
            spinner_frame = (spinner_frame + 1) % 10;
            last_tick = Instant::now();
        }

        // Non-blocking check for audit results (no Mutex blocking render)
        if let Ok(audit_event) = audit_rx.try_recv() {
            match audit_event {
                AuditEvent::StatusUpdate(s) => {
                    app.loading_status = s;
                }
                AuditEvent::Complete(report) => {
                    app.report = Some(*report);
                    app.populate_categories();
                    app.active_screen = ActiveScreen::Dashboard;
                    load_start = None;
                }
                AuditEvent::Error(e) => {
                    app.active_screen = ActiveScreen::Error(e);
                    load_start = None;
                }
            }
        }
    }

    Ok(())
}

// ─── Input Handler ────────────────────────────────────────────────────────────

async fn handle_input(app: &mut App, key: KeyEvent, audit_tx: &mpsc::Sender<AuditEvent>) -> bool {
    // Global ESC from setup/error/dashboard = quit (from loading it cancels to setup)
    if key.code == KeyCode::Esc {
        match &app.active_screen {
            ActiveScreen::Setup => return true,
            ActiveScreen::Loading => {
                // Return to setup (background task will error out naturally)
                app.active_screen = ActiveScreen::Setup;
                return false;
            }
            ActiveScreen::Dashboard => {
                app.active_screen = ActiveScreen::Setup;
                app.report = None;
                app.categories.clear();
                return false;
            }
            ActiveScreen::Error(_) => {
                app.active_screen = ActiveScreen::Setup;
                return false;
            }
        }
    }

    match &app.active_screen {
        ActiveScreen::Setup => handle_setup_input(app, key, audit_tx).await,
        ActiveScreen::Loading => {} // Background handles it
        ActiveScreen::Dashboard => handle_dashboard_input(app, key, audit_tx),
        ActiveScreen::Error(_) => {
            if key.code == KeyCode::Enter || key.code == KeyCode::Char('q') {
                app.active_screen = ActiveScreen::Setup;
            }
        }
    }

    false
}

async fn handle_setup_input(
    app: &mut App,
    key: KeyEvent,
    audit_tx: &mpsc::Sender<AuditEvent>,
) {
    match key.code {
        KeyCode::Tab | KeyCode::Down => {
            app.selected_setup_field = match app.selected_setup_field {
                SetupField::Url => SetupField::Preset,
                SetupField::Preset => SetupField::FastMode,
                SetupField::FastMode => SetupField::HtmlReport,
                SetupField::HtmlReport => SetupField::Url,
            };
        }
        KeyCode::BackTab | KeyCode::Up => {
            app.selected_setup_field = match app.selected_setup_field {
                SetupField::Url => SetupField::HtmlReport,
                SetupField::Preset => SetupField::Url,
                SetupField::FastMode => SetupField::Preset,
                SetupField::HtmlReport => SetupField::FastMode,
            };
        }
        KeyCode::Left => {
            if app.selected_setup_field == SetupField::Preset && app.preset_index > 0 {
                app.preset_index -= 1;
            }
        }
        KeyCode::Right => {
            if app.selected_setup_field == SetupField::Preset && app.preset_index < 2 {
                app.preset_index += 1;
            }
        }
        KeyCode::Char(' ') if app.selected_setup_field == SetupField::FastMode => {
            app.fast_mode = !app.fast_mode;
        }
        KeyCode::Char(c) => match app.selected_setup_field {
            SetupField::Url => app.url_input.push(c),
            SetupField::Preset => {
                if c == '1' || c == 'b' {
                    app.preset_index = 0;
                } else if c == '2' || c == 'a' {
                    app.preset_index = 1;
                } else if c == '3' || c == 's' {
                    app.preset_index = 2;
                }
            }
            SetupField::FastMode => {
                if c == 'y' || c == '1' {
                    app.fast_mode = true;
                } else if c == 'n' || c == '0' {
                    app.fast_mode = false;
                }
            }
            SetupField::HtmlReport => app.html_report_path.push(c),
        },
        KeyCode::Backspace => match app.selected_setup_field {
            SetupField::Url => {
                app.url_input.pop();
            }
            SetupField::Preset => {}
            SetupField::FastMode => {}
            SetupField::HtmlReport => {
                app.html_report_path.pop();
            }
        },
        KeyCode::Enter => {
            app.active_screen = ActiveScreen::Loading;

            let url = app.url_input.clone();
            let preset = match app.preset_index {
                0 => "basic",
                1 => "advanced",
                _ => "strict",
            }
            .to_string();
            let html_path = app.html_report_path.clone();
            let tx = audit_tx.clone();

            if app.fast_mode {
                app.loading_status = "Fetching page (fast path)...".to_string();
                let fast_bin_path = app.fast_bin_path.clone();
                tokio::spawn(async move {
                    run_fast_audit_process(tx, fast_bin_path, url).await;
                });
            } else {
                app.loading_status = "Launching Playwright browser engine...".to_string();
                let cli_path = app.cli_path.clone();
                tokio::spawn(async move {
                    run_audit_process(tx, cli_path, url, preset, html_path).await;
                });
            }
        }
        _ => {}
    }
}

fn handle_dashboard_input(app: &mut App, key: KeyEvent, audit_tx: &mpsc::Sender<AuditEvent>) {
    match key.code {
        KeyCode::Left | KeyCode::BackTab => {
            app.active_panel_right = false;
        }
        KeyCode::Right | KeyCode::Tab => {
            app.active_panel_right = true;
        }
        KeyCode::Down => {
            if app.active_panel_right {
                if let Some(curr) = app.check_list_state.selected() {
                    let cat_idx = app.category_list_state.selected().unwrap_or(0);
                    if let Some((_, checks)) = app.categories.get(cat_idx) {
                        let filtered = app.filtered_checks(checks);
                        if curr + 1 < filtered.len() {
                            app.check_list_state.select(Some(curr + 1));
                        }
                    }
                }
            } else if let Some(curr) = app.category_list_state.selected() {
                if curr + 1 < app.categories.len() {
                    app.category_list_state.select(Some(curr + 1));
                    app.check_list_state.select(Some(0));
                }
            }
        }
        KeyCode::Up => {
            if app.active_panel_right {
                if let Some(curr) = app.check_list_state.selected() {
                    if curr > 0 {
                        app.check_list_state.select(Some(curr - 1));
                    }
                }
            } else if let Some(curr) = app.category_list_state.selected() {
                if curr > 0 {
                    app.category_list_state.select(Some(curr - 1));
                    app.check_list_state.select(Some(0));
                }
            }
        }
        KeyCode::Char('q') | KeyCode::Char('Q') => {
            app.active_screen = ActiveScreen::Setup;
            app.report = None;
            app.categories.clear();
        }
        KeyCode::Char('a') | KeyCode::Char('A') => {
            app.severity_filter = SeverityFilter::All;
            app.check_list_state.select(Some(0));
        }
        KeyCode::Char('e') | KeyCode::Char('E') => {
            app.severity_filter = SeverityFilter::ErrorsOnly;
            app.check_list_state.select(Some(0));
        }
        KeyCode::Char('w') | KeyCode::Char('W') => {
            app.severity_filter = SeverityFilter::WarningsOnly;
            app.check_list_state.select(Some(0));
        }
        KeyCode::Char('f') | KeyCode::Char('F') => {
            let is_fast = app.report.as_ref().map(|r| r.fast).unwrap_or(false);
            if is_fast {
                app.active_screen = ActiveScreen::Loading;
                app.loading_status = "Launching Playwright browser engine (full audit)...".to_string();

                let url = app.url_input.clone();
                let preset = match app.preset_index {
                    0 => "basic",
                    1 => "advanced",
                    _ => "strict",
                }
                .to_string();
                let html_path = app.html_report_path.clone();
                let cli_path = app.cli_path.clone();
                let tx = audit_tx.clone();

                tokio::spawn(async move {
                    run_audit_process(tx, cli_path, url, preset, html_path).await;
                });
            }
        }
        _ => {}
    }
}

// ─── Background Audit Task ────────────────────────────────────────────────────

async fn run_audit_process(
    tx: mpsc::Sender<AuditEvent>,
    cli_path: String,
    url: String,
    preset: String,
    html_path: String,
) {
    let _ = tx
        .send(AuditEvent::StatusUpdate(format!(
            "Executing SEO audit for {}...",
            url
        )))
        .await;

    let mut cmd = Command::new("node");
    cmd.arg(&cli_path)
        .arg("--url")
        .arg(&url)
        .arg("--preset")
        .arg(&preset)
        .arg("--json");

    if !html_path.is_empty() {
        cmd.arg("--html").arg(&html_path);
    }

    cmd.stdout(Stdio::piped()).stderr(Stdio::piped());

    match cmd.spawn() {
        Ok(child) => {
            let _ = tx
                .send(AuditEvent::StatusUpdate(
                    "Browser launched, running checks...".to_string(),
                ))
                .await;

            match child.wait_with_output().await {
                Ok(out) => {
                    if out.status.success() {
                        let stdout_str = String::from_utf8_lossy(&out.stdout);
                        // stdout is guaranteed clean JSON under --json: the CLI's
                        // only stdout write is the report itself (src/cli.ts), and
                        // its logger writes to stderr (src/config/logger.ts) — so
                        // no preamble-scanning fallback is needed here. If this
                        // ever fails to parse, something upstream regressed and
                        // silently re-scanning for a stray '{' would only hide it.
                        match serde_json::from_str::<SEOReport>(&stdout_str) {
                            Ok(parsed_report) => {
                                let _ = tx
                                    .send(AuditEvent::Complete(Box::new(parsed_report)))
                                    .await;
                            }
                            Err(err) => {
                                let _ = tx
                                    .send(AuditEvent::Error(format!(
                                        "JSON parse failed: {}. Output: {}",
                                        err,
                                        stdout_str.chars().take(200).collect::<String>()
                                    )))
                                    .await;
                            }
                        }
                    } else {
                        let stderr_str = String::from_utf8_lossy(&out.stderr);
                        let _ = tx
                            .send(AuditEvent::Error(format!(
                                "Audit process exited with error: {}",
                                stderr_str.chars().take(400).collect::<String>()
                            )))
                            .await;
                    }
                }
                Err(err) => {
                    let _ = tx
                        .send(AuditEvent::Error(format!("Process wait error: {}", err)))
                        .await;
                }
            }
        }
        Err(err) => {
            let _ = tx
                .send(AuditEvent::Error(format!(
                    "Failed to spawn node. Ensure node is on PATH and {} exists. Error: {}",
                    cli_path, err
                )))
                .await;
        }
    }
}

/// The `--fast` path: runs `aviary-fast <url>` (engine/src/bin/aviary_fast.rs)
/// instead of the full Node/Playwright CLI. Its stdout is already shaped as
/// a SEOReport JSON (a subset of the 28 categories — see that binary's
/// module docs), so it's parsed identically to `run_audit_process`'s output.
async fn run_fast_audit_process(tx: mpsc::Sender<AuditEvent>, fast_bin_path: String, url: String) {
    let _ = tx
        .send(AuditEvent::StatusUpdate(format!(
            "Fetching {} (fast path: meta tags, headings, security, content only)...",
            url
        )))
        .await;

    let mut cmd = Command::new(&fast_bin_path);
    cmd.arg(&url);
    cmd.stdout(Stdio::piped()).stderr(Stdio::piped());

    match cmd.spawn() {
        Ok(child) => match child.wait_with_output().await {
            Ok(out) => {
                if out.status.success() {
                    let stdout_str = String::from_utf8_lossy(&out.stdout);
                    match serde_json::from_str::<SEOReport>(&stdout_str) {
                        Ok(parsed_report) => {
                            let _ = tx.send(AuditEvent::Complete(Box::new(parsed_report))).await;
                        }
                        Err(err) => {
                            let _ = tx
                                .send(AuditEvent::Error(format!(
                                    "JSON parse failed: {}. Output: {}",
                                    err,
                                    stdout_str.chars().take(200).collect::<String>()
                                )))
                                .await;
                        }
                    }
                } else {
                    let stderr_str = String::from_utf8_lossy(&out.stderr);
                    let _ = tx
                        .send(AuditEvent::Error(format!(
                            "Fast-path process exited with error: {}",
                            stderr_str.chars().take(400).collect::<String>()
                        )))
                        .await;
                }
            }
            Err(err) => {
                let _ = tx
                    .send(AuditEvent::Error(format!("Process wait error: {}", err)))
                    .await;
            }
        },
        Err(err) => {
            let _ = tx
                .send(AuditEvent::Error(format!(
                    "Failed to spawn {}. Build it with `cargo build --bin aviary-fast` or pass --fast-bin. Error: {}",
                    fast_bin_path, err
                )))
                .await;
        }
    }
}

// ─── UI Drawing ───────────────────────────────────────────────────────────────

fn draw_ui(f: &mut Frame, app: &App, spinner_frame: usize, elapsed_secs: u64) {
    let size = f.area();

    // Brutalist black background
    f.render_widget(
        Block::default().style(Style::default().bg(BG).fg(FG)),
        size,
    );

    match &app.active_screen {
        ActiveScreen::Setup => draw_setup(f, size, app),
        ActiveScreen::Loading => draw_loading(f, size, app, spinner_frame, elapsed_secs),
        ActiveScreen::Dashboard => draw_dashboard(f, size, app),
        ActiveScreen::Error(msg) => draw_error(f, size, msg),
    }
}

// ─── Setup Screen ─────────────────────────────────────────────────────────────

fn draw_setup(f: &mut Frame, area: Rect, app: &App) {
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .margin(1)
        .constraints([
            Constraint::Length(1), // Header title line
            Constraint::Length(1), // Separator
            Constraint::Length(3), // URL input
            Constraint::Length(3), // Preset
            Constraint::Length(3), // Fast mode
            Constraint::Length(3), // HTML output
            Constraint::Length(1), // Separator
            Constraint::Length(1), // Footer
        ])
        .split(area);

    // ── Header
    let header = Paragraph::new(Line::from(vec![
        Span::styled(
            "AVIARY AUDIT ENGINE v1.0",
            Style::default().fg(FG).add_modifier(Modifier::BOLD),
        ),
        Span::styled(
            format!(
                "{:>width$}",
                "[ESC:QUIT]",
                width = (area.width as usize).saturating_sub(26)
            ),
            Style::default().fg(DIM),
        ),
    ]))
    .style(Style::default().bg(BG));
    f.render_widget(header, chunks[0]);

    // ── Top separator (double line)
    let sep = Paragraph::new("═".repeat(area.width as usize))
        .style(Style::default().fg(DIM).bg(BG));
    f.render_widget(sep, chunks[1]);

    // ── URL Field
    let url_active = app.selected_setup_field == SetupField::Url;
    let url_border = if url_active { RED } else { DIM };
    let url_label = if url_active { "TARGET URL ▶" } else { "TARGET URL" };
    let url_widget = Paragraph::new(Line::from(vec![
        Span::styled("> ", Style::default().fg(RED)),
        Span::styled(app.url_input.clone(), Style::default().fg(FG)),
        Span::styled("_", Style::default().fg(if url_active { RED } else { DIM })),
    ]))
    .block(
        Block::default()
            .borders(Borders::ALL)
            .border_style(Style::default().fg(url_border))
            .title(Span::styled(
                format!(" {} ", url_label),
                Style::default().fg(if url_active { RED } else { MID }),
            )),
    )
    .style(Style::default().bg(BG));
    f.render_widget(url_widget, chunks[2]);

    // ── Preset Field
    let preset_active = app.selected_setup_field == SetupField::Preset;
    let preset_border = if preset_active { RED } else { DIM };
    let preset_label = if preset_active {
        "PRESET ▶"
    } else {
        "PRESET"
    };
    let preset_names = ["BASIC", "ADVANCED", "STRICT"];
    let mut preset_spans: Vec<Span> = Vec::new();
    for (i, name) in preset_names.iter().enumerate() {
        if i == app.preset_index {
            preset_spans.push(Span::styled(
                format!("[{}]", name),
                Style::default()
                    .fg(YELLOW)
                    .add_modifier(Modifier::BOLD),
            ));
        } else {
            preset_spans.push(Span::styled(
                format!(" {} ", name),
                Style::default().fg(DIM),
            ));
        }
        if i < 2 {
            preset_spans.push(Span::styled("  ", Style::default()));
        }
    }
    let preset_widget = Paragraph::new(Line::from(preset_spans))
        .block(
            Block::default()
                .borders(Borders::ALL)
                .border_style(Style::default().fg(preset_border))
                .title(Span::styled(
                    format!(" {} ", preset_label),
                    Style::default().fg(if preset_active { RED } else { MID }),
                )),
        )
        .style(Style::default().bg(BG));
    f.render_widget(preset_widget, chunks[3]);

    // ── Fast Mode Field
    let fast_active = app.selected_setup_field == SetupField::FastMode;
    let fast_border = if fast_active { RED } else { DIM };
    let fast_label = if fast_active {
        "FAST PATH ▶"
    } else {
        "FAST PATH"
    };
    let fast_widget = Paragraph::new(Line::from(vec![
        if app.fast_mode {
            Span::styled(
                "[ON]  meta tags · headings · security · content (Rust, no browser)",
                Style::default().fg(YELLOW).add_modifier(Modifier::BOLD),
            )
        } else {
            Span::styled(
                "[OFF] full 28-category Playwright audit",
                Style::default().fg(DIM),
            )
        },
    ]))
    .block(
        Block::default()
            .borders(Borders::ALL)
            .border_style(Style::default().fg(fast_border))
            .title(Span::styled(
                format!(" {} ", fast_label),
                Style::default().fg(if fast_active { RED } else { MID }),
            )),
    )
    .style(Style::default().bg(BG));
    f.render_widget(fast_widget, chunks[4]);

    // ── HTML Output Field
    let html_active = app.selected_setup_field == SetupField::HtmlReport;
    let html_border = if html_active { RED } else { DIM };
    let html_label = if html_active {
        "HTML OUTPUT ▶"
    } else {
        "HTML OUTPUT"
    };
    let html_widget = Paragraph::new(Line::from(vec![
        Span::styled("> ", Style::default().fg(MID)),
        Span::styled(app.html_report_path.clone(), Style::default().fg(FG)),
        Span::styled("_", Style::default().fg(if html_active { RED } else { DIM })),
    ]))
    .block(
        Block::default()
            .borders(Borders::ALL)
            .border_style(Style::default().fg(html_border))
            .title(Span::styled(
                format!(" {} ", html_label),
                Style::default().fg(if html_active { RED } else { MID }),
            )),
    )
    .style(Style::default().bg(BG));
    f.render_widget(html_widget, chunks[5]);

    // ── Bottom separator
    let sep2 = Paragraph::new("═".repeat(area.width as usize))
        .style(Style::default().fg(DIM).bg(BG));
    f.render_widget(sep2, chunks[6]);

    // ── Footer / keybindings
    let footer = Paragraph::new(Line::from(vec![
        Span::styled("TAB", Style::default().fg(YELLOW).add_modifier(Modifier::BOLD)),
        Span::styled(":NEXT  ", Style::default().fg(DIM)),
        Span::styled("ENTER", Style::default().fg(YELLOW).add_modifier(Modifier::BOLD)),
        Span::styled(":LAUNCH  ", Style::default().fg(DIM)),
        Span::styled("←/→", Style::default().fg(YELLOW).add_modifier(Modifier::BOLD)),
        Span::styled(":PRESET  ", Style::default().fg(DIM)),
        Span::styled("SPACE", Style::default().fg(YELLOW).add_modifier(Modifier::BOLD)),
        Span::styled(":TOGGLE FAST  ", Style::default().fg(DIM)),
        Span::styled("ESC", Style::default().fg(YELLOW).add_modifier(Modifier::BOLD)),
        Span::styled(":QUIT", Style::default().fg(DIM)),
    ]))
    .style(Style::default().bg(BG));
    f.render_widget(footer, chunks[7]);
}

// ─── Loading Screen ───────────────────────────────────────────────────────────

fn draw_loading(f: &mut Frame, area: Rect, app: &App, spinner_frame: usize, elapsed_secs: u64) {
    const SPINNERS: [&str; 10] = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
    let spinner = SPINNERS[spinner_frame % 10];

    // Center a loading box
    let box_width = (area.width * 2 / 3).max(40).min(area.width - 4);
    let box_height: u16 = 8;
    let x = (area.width.saturating_sub(box_width)) / 2;
    let y = (area.height.saturating_sub(box_height)) / 2;
    let loading_area = Rect {
        x,
        y,
        width: box_width,
        height: box_height,
    };

    // Build progress bar (fake animated, cycles through 0-100% based on spinner)
    let bar_width = (box_width as usize).saturating_sub(6);
    let filled = (spinner_frame * bar_width / 10).min(bar_width);
    let empty = bar_width.saturating_sub(filled);
    let progress_bar = format!(
        "[{}{}]",
        "▓".repeat(filled),
        "░".repeat(empty)
    );

    let elapsed_str = format!("{:02}:{:02}", elapsed_secs / 60, elapsed_secs % 60);

    let content = vec![
        Line::from(vec![
            Span::styled(spinner, Style::default().fg(RED).add_modifier(Modifier::BOLD)),
            Span::raw(" "),
            Span::styled(
                app.loading_status.clone(),
                Style::default().fg(FG),
            ),
        ]),
        Line::from(""),
        Line::from(Span::styled(progress_bar, Style::default().fg(GREEN))),
        Line::from(""),
        Line::from(vec![
            Span::styled("ELAPSED: ", Style::default().fg(DIM)),
            Span::styled(elapsed_str, Style::default().fg(YELLOW)),
        ]),
    ];

    let loading_widget = Paragraph::new(content)
        .block(
            Block::default()
                .borders(Borders::ALL)
                .border_style(Style::default().fg(RED))
                .title(Span::styled(
                    " AUDIT IN PROGRESS ",
                    Style::default()
                        .fg(RED)
                        .add_modifier(Modifier::BOLD),
                )),
        )
        .style(Style::default().bg(BG).fg(FG));

    f.render_widget(loading_widget, loading_area);
}

// ─── Error Screen ─────────────────────────────────────────────────────────────

fn draw_error(f: &mut Frame, area: Rect, msg: &str) {
    let box_width = (area.width * 2 / 3).max(50).min(area.width - 4);
    let box_height: u16 = 10;
    let x = (area.width.saturating_sub(box_width)) / 2;
    let y = (area.height.saturating_sub(box_height)) / 2;
    let err_area = Rect {
        x,
        y,
        width: box_width,
        height: box_height,
    };

    let error_widget = Paragraph::new(vec![
        Line::from(""),
        Line::from(Span::styled(
            "AUDIT FAILED",
            Style::default()
                .fg(RED)
                .add_modifier(Modifier::BOLD),
        )),
        Line::from(""),
        Line::from(Span::styled(msg, Style::default().fg(FG))),
        Line::from(""),
        Line::from(Span::styled(
            "PRESS ENTER OR Q TO RETURN",
            Style::default().fg(DIM),
        )),
    ])
    .wrap(Wrap { trim: true })
    .block(
        Block::default()
            .borders(Borders::ALL)
            .border_style(Style::default().fg(RED))
            .title(Span::styled(
                " ERROR ",
                Style::default().fg(RED).add_modifier(Modifier::BOLD),
            )),
    )
    .style(Style::default().bg(BG).fg(FG));

    f.render_widget(error_widget, err_area);
}

// ─── Dashboard Screen ─────────────────────────────────────────────────────────

fn draw_dashboard(f: &mut Frame, area: Rect, app: &App) {
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(3), // Header bar
            Constraint::Min(5),    // Main content: categories + checks
            Constraint::Length(4), // Detail pane
            Constraint::Length(1), // Footer
        ])
        .split(area);

    let report = match &app.report {
        Some(r) => r,
        None => return,
    };

    // ── Header bar
    draw_dashboard_header(f, chunks[0], app, report);

    // ── Main panels: categories (left) + checks (right)
    let panels = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([
            Constraint::Percentage(28),
            Constraint::Percentage(72),
        ])
        .split(chunks[1]);

    draw_category_panel(f, panels[0], app);
    draw_checks_panel(f, panels[1], app);

    // ── Detail pane (bottom)
    draw_detail_pane(f, chunks[2], app);

    // ── Footer
    let filter_label = match app.severity_filter {
        SeverityFilter::All => "ALL",
        SeverityFilter::ErrorsOnly => "ERRORS",
        SeverityFilter::WarningsOnly => "WARNINGS",
    };
    let mut footer_spans = vec![
        Span::styled("TAB", Style::default().fg(YELLOW).add_modifier(Modifier::BOLD)),
        Span::styled(":PANEL  ", Style::default().fg(DIM)),
        Span::styled("↑↓", Style::default().fg(YELLOW).add_modifier(Modifier::BOLD)),
        Span::styled(":SCROLL  ", Style::default().fg(DIM)),
        Span::styled("A", Style::default().fg(YELLOW).add_modifier(Modifier::BOLD)),
        Span::styled(":ALL  ", Style::default().fg(DIM)),
        Span::styled("E", Style::default().fg(YELLOW).add_modifier(Modifier::BOLD)),
        Span::styled(":ERRORS  ", Style::default().fg(DIM)),
        Span::styled("W", Style::default().fg(YELLOW).add_modifier(Modifier::BOLD)),
        Span::styled(":WARNINGS  ", Style::default().fg(DIM)),
    ];
    if report.fast {
        footer_spans.push(Span::styled("F", Style::default().fg(YELLOW).add_modifier(Modifier::BOLD)));
        footer_spans.push(Span::styled(":FULL AUDIT  ", Style::default().fg(DIM)));
    }
    footer_spans.push(Span::styled("Q", Style::default().fg(YELLOW).add_modifier(Modifier::BOLD)));
    footer_spans.push(Span::styled(":BACK  ", Style::default().fg(DIM)));
    footer_spans.push(Span::styled("ESC", Style::default().fg(YELLOW).add_modifier(Modifier::BOLD)));
    footer_spans.push(Span::styled(":QUIT  ", Style::default().fg(DIM)));
    footer_spans.push(Span::styled("FILTER:", Style::default().fg(DIM)));
    footer_spans.push(Span::styled(
        filter_label,
        Style::default().fg(YELLOW).add_modifier(Modifier::BOLD),
    ));
    let footer = Paragraph::new(Line::from(footer_spans)).style(Style::default().bg(BG));
    f.render_widget(footer, chunks[3]);
}

fn draw_dashboard_header(f: &mut Frame, area: Rect, app: &App, report: &SEOReport) {
    let score = report.score;
    let grade = app.get_grade();
    let grade_color = match score {
        Some(s) if s >= 80 => GREEN,
        Some(s) if s >= 60 => YELLOW,
        Some(_) => RED,
        None => MID,
    };
    let score_display = match score {
        Some(s) => format!("{s}/100"),
        None => "N/A".to_string(),
    };

    // Score bar: 20 chars wide
    let bar_width: usize = 20;
    let filled = score.map(|s| (s * bar_width / 100).min(bar_width)).unwrap_or(0);
    let empty = bar_width.saturating_sub(filled);
    let score_bar = format!("{}{}", "▓".repeat(filled), "░".repeat(empty));

    // Trim URL to fit
    let url_max = (area.width as usize).saturating_sub(60);
    let url_display: String = if report.url.len() > url_max {
        format!("{}…", &report.url[..url_max.saturating_sub(1)])
    } else {
        report.url.clone()
    };

    let header = Paragraph::new(vec![
        Line::from(vec![
            Span::styled("AVIARY", Style::default().fg(FG).add_modifier(Modifier::BOLD)),
            Span::styled(" │ ", Style::default().fg(DIM)),
            Span::styled(url_display, Style::default().fg(MID)),
            Span::styled(" │ SCORE: ", Style::default().fg(DIM)),
            Span::styled(
                score_display,
                Style::default()
                    .fg(grade_color)
                    .add_modifier(Modifier::BOLD),
            ),
            Span::styled(" [", Style::default().fg(DIM)),
            Span::styled(grade, Style::default().fg(grade_color).add_modifier(Modifier::BOLD)),
            Span::styled("] │ ", Style::default().fg(DIM)),
            Span::styled(
                format!("PASS:{}", report.summary.passed),
                Style::default().fg(GREEN),
            ),
            Span::styled(" ", Style::default()),
            Span::styled(
                format!("FAIL:{}", report.summary.failed),
                Style::default().fg(RED),
            ),
            if report.fast {
                Span::styled(
                    format!("  ⚡FAST ({}/28)", report.fast_categories.len()),
                    Style::default().fg(YELLOW).add_modifier(Modifier::BOLD),
                )
            } else {
                Span::raw("")
            },
        ]),
        Line::from(Span::styled(
            score_bar,
            Style::default().fg(grade_color),
        )),
    ])
    .block(
        Block::default()
            .borders(Borders::BOTTOM)
            .border_style(Style::default().fg(DIM)),
    )
    .style(Style::default().bg(BG));

    f.render_widget(header, area);
}

fn draw_category_panel(f: &mut Frame, area: Rect, app: &App) {
    let border_style = if !app.active_panel_right {
        Style::default().fg(RED)
    } else {
        Style::default().fg(DIM)
    };

    let items: Vec<ListItem> = app
        .categories
        .iter()
        .map(|(name, checks)| {
            let failed = checks.iter().filter(|c| !c.passed).count();
            let (label, color) = if failed > 0 {
                (format!("{} ({}✗)", name, failed), RED)
            } else {
                (name.clone(), GREEN)
            };
            ListItem::new(Span::styled(label, Style::default().fg(color)))
        })
        .collect();

    let list = List::new(items)
        .block(
            Block::default()
                .borders(Borders::ALL)
                .border_style(border_style)
                .title(Span::styled(
                    " CATEGORIES ",
                    Style::default().fg(FG).add_modifier(Modifier::BOLD),
                )),
        )
        .highlight_style(
            Style::default()
                .bg(Color::Rgb(40, 40, 40))
                .add_modifier(Modifier::BOLD),
        )
        .highlight_symbol("▶ ")
        .style(Style::default().bg(BG));

    let mut state = app.category_list_state.clone();
    f.render_stateful_widget(list, area, &mut state);
}

fn draw_checks_panel(f: &mut Frame, area: Rect, app: &App) {
    let border_style = if app.active_panel_right {
        Style::default().fg(RED)
    } else {
        Style::default().fg(DIM)
    };

    let cat_idx = app.category_list_state.selected().unwrap_or(0);
    let title_name = app
        .categories
        .get(cat_idx)
        .map(|(n, _)| n.as_str())
        .unwrap_or("CHECKS");

    if let Some((_, checks)) = app.categories.get(cat_idx) {
        let filtered = app.filtered_checks(checks);

        let items: Vec<ListItem> = filtered
            .iter()
            .map(|check| {
                let (badge, badge_color) = if check.passed {
                    ("[PASS]", GREEN)
                } else {
                    ("[FAIL]", RED)
                };

                let sev_span = if !check.passed {
                    if let Some(sev) = &check.severity {
                        let sev_color = match sev.as_str() {
                            "error" => RED,
                            "warning" => YELLOW,
                            _ => MID,
                        };
                        Some(Span::styled(
                            format!(" ({})", sev.to_uppercase()),
                            Style::default().fg(sev_color),
                        ))
                    } else {
                        None
                    }
                } else {
                    None
                };

                let mut spans = vec![
                    Span::styled(
                        badge,
                        Style::default()
                            .fg(badge_color)
                            .add_modifier(Modifier::BOLD),
                    ),
                    Span::raw(" "),
                    Span::styled(check.message.clone(), Style::default().fg(FG)),
                ];
                if let Some(s) = sev_span {
                    spans.push(s);
                }
                ListItem::new(Line::from(spans))
            })
            .collect();

        let filter_indicator = match app.severity_filter {
            SeverityFilter::All => "",
            SeverityFilter::ErrorsOnly => " [ERRORS]",
            SeverityFilter::WarningsOnly => " [WARNINGS]",
        };

        let list = List::new(items)
            .block(
                Block::default()
                    .borders(Borders::ALL)
                    .border_style(border_style)
                    .title(Span::styled(
                        format!(" {} CHECKS{} ", title_name, filter_indicator),
                        Style::default().fg(FG).add_modifier(Modifier::BOLD),
                    )),
            )
            .highlight_style(
                Style::default()
                    .bg(Color::Rgb(40, 40, 40))
                    .add_modifier(Modifier::BOLD),
            )
            .highlight_symbol("▶ ")
            .style(Style::default().bg(BG));

        let mut state = app.check_list_state.clone();
        f.render_stateful_widget(list, area, &mut state);
    } else {
        let empty = Paragraph::new("NO CHECKS AVAILABLE")
            .block(
                Block::default()
                    .borders(Borders::ALL)
                    .border_style(border_style)
                    .title(" CHECKS "),
            )
            .style(Style::default().bg(BG).fg(DIM));
        f.render_widget(empty, area);
    }
}

fn draw_detail_pane(f: &mut Frame, area: Rect, app: &App) {
    let cat_idx = app.category_list_state.selected().unwrap_or(0);
    let check_idx = app.check_list_state.selected().unwrap_or(0);

    let detail_text: Vec<Line> = if let Some((_, checks)) = app.categories.get(cat_idx) {
        let filtered = app.filtered_checks(checks);
        if let Some(check) = filtered.get(check_idx) {
            let status_color = if check.passed { GREEN } else { RED };
            let status = if check.passed { "PASS" } else { "FAIL" };

            let mut lines = vec![
                Line::from(vec![
                    Span::styled(
                        format!("[{}] ", status),
                        Style::default().fg(status_color).add_modifier(Modifier::BOLD),
                    ),
                    Span::styled(check.message.clone(), Style::default().fg(FG)),
                ]),
            ];

            if let Some(sev) = &check.severity {
                let sev_color = match sev.as_str() {
                    "error" => RED,
                    "warning" => YELLOW,
                    _ => MID,
                };
                lines.push(Line::from(vec![
                    Span::styled("SEVERITY: ", Style::default().fg(DIM)),
                    Span::styled(
                        sev.to_uppercase(),
                        Style::default().fg(sev_color).add_modifier(Modifier::BOLD),
                    ),
                ]));
            }

            if let Some(details) = &check.details {
                let detail_str = serde_json::to_string(details).unwrap_or_default();
                let truncated: String = detail_str.chars().take(200).collect();
                lines.push(Line::from(vec![
                    Span::styled("DETAILS: ", Style::default().fg(DIM)),
                    Span::styled(truncated, Style::default().fg(MID)),
                ]));
            }

            lines
        } else {
            vec![Line::from(Span::styled(
                "SELECT A CHECK TO VIEW DETAILS",
                Style::default().fg(DIM),
            ))]
        }
    } else {
        vec![Line::from(Span::styled(
            "NO DATA",
            Style::default().fg(DIM),
        ))]
    };

    let detail_widget = Paragraph::new(detail_text)
        .block(
            Block::default()
                .borders(Borders::TOP)
                .border_style(Style::default().fg(DIM))
                .title(Span::styled(
                    " DETAIL ",
                    Style::default().fg(MID).add_modifier(Modifier::BOLD),
                )),
        )
        .wrap(Wrap { trim: true })
        .style(Style::default().bg(BG).fg(FG));

    f.render_widget(detail_widget, area);
}
