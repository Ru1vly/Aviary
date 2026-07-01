use crossterm::{
    event::{self, DisableMouseCapture, EnableMouseCapture, Event, KeyCode, KeyModifiers},
    execute,
    terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen},
};
use ratatui::{
    backend::{Backend, CrosstermBackend},
    layout::{Constraint, Direction, Layout, Rect},
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Borders, Clear, List, ListItem, ListState, Paragraph, Wrap},
    Frame, Terminal,
};
use serde::{Deserialize, Serialize};
use std::{
    io,
    process::Stdio,
    sync::{Arc, Mutex},
    time::Duration,
};
use tokio::process::Command;

// ─── Structs for SEO JSON Schema ──────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SEOCheckResult {
    pub passed: bool,
    pub message: String,
    pub severity: Option<String>,
    pub details: Option<serde_json::Value>,
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
    pub score: usize,
    pub timestamp: String,
    pub summary: SEOReportSummary,
    pub checks: SEOReportChecks,
}

// ─── TUI State ───────────────────────────────────────────────────────────────

#[derive(PartialEq)]
enum ActiveScreen {
    Setup,
    Loading,
    Dashboard,
    Error(String),
}

#[derive(PartialEq)]
enum SetupField {
    Url,
    Preset,
    HtmlReport,
}

struct App {
    active_screen: ActiveScreen,
    cli_path: String,

    // Setup fields
    url_input: String,
    preset_index: usize, // 0 = Basic, 1 = Advanced, 2 = Strict
    html_report_path: String,
    selected_setup_field: SetupField,

    // Loading status
    loading_status: String,

    // Report data
    report: Option<SEOReport>,
    categories: Vec<(String, Vec<SEOCheckResult>)>,
    category_list_state: ListState,
    check_list_state: ListState,
    active_panel_right: bool, // false = category list, true = check list
}

impl App {
    fn new(cli_path: String) -> App {
        let mut app = App {
            active_screen: ActiveScreen::Setup,
            cli_path,
            url_input: "https://".to_string(),
            preset_index: 1, // Advanced by default
            html_report_path: "seo-report.html".to_string(),
            selected_setup_field: SetupField::Url,
            loading_status: String::new(),
            report: None,
            categories: Vec::new(),
            category_list_state: ListState::default(),
            check_list_state: ListState::default(),
            active_panel_right: false,
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

            add("Meta Tags", &c.meta_tags);
            add("Headings", &c.headings);
            add("Images", &c.images);
            add("Performance", &c.performance);
            add("Robots.txt", &c.robots_txt);
            add("Sitemap", &c.sitemap);
            add("Security", &c.security);
            add("Structured Data", &c.structured_data);
            add("Social Media", &c.social_media);
            add("Content", &c.content);
            add("Links", &c.links);
            add("UI Elements", &c.ui_elements);
            add("Technical SEO", &c.technical);
            add("Accessibility", &c.accessibility);
            add("URL Factors", &c.url_factors);
            add("Spam Detection", &c.spam_detection);
            add("Page Quality", &c.page_quality);
            add("Advanced Images", &c.advanced_images);
            add("Multimedia", &c.multimedia);
            add("Core Web Vitals", &c.core_web_vitals);
            add("Analytics", &c.analytics);
            add("Mobile UX", &c.mobile_ux);
            add("Schema Validation", &c.schema_validation);
            add("Resource Optimization", &c.resource_optimization);
            add("Legal & Compliance", &c.legal_compliance);
            add("E-commerce", &c.ecommerce);
            add("Internationalization", &c.internationalization);
            add("Heatmap & UX", &c.heatmap);

            self.categories = cats;
            self.category_list_state.select(Some(0));
            self.check_list_state.select(Some(0));
        }
    }

    fn get_grade(&self) -> &str {
        if let Some(r) = &self.report {
            if r.score >= 90 { "A" }
            else if r.score >= 80 { "B" }
            else if r.score >= 70 { "C" }
            else if r.score >= 60 { "D" }
            else { "F" }
        } else {
            ""
        }
    }
}

// ─── Main TUI Loop ────────────────────────────────────────────────────────────

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Parse arguments to locate TypeScript CLI file
    let mut cli_path = String::new();
    let args: Vec<String> = std::env::args().collect();
    for i in 0..args.len() {
        if args[i] == "--cli-path" && i + 1 < args.len() {
            cli_path = args[i + 1].clone();
        }
    }

    if cli_path.is_empty() {
        // Fallback to checking default dist/cli.js from current workspace path
        cli_path = "dist/cli.js".to_string();
    }

    // Set up terminal
    enable_raw_mode()?;
    let mut stdout = io::stdout();
    execute!(stdout, EnterAlternateScreen, EnableMouseCapture)?;
    let backend = CrosstermBackend::new(stdout);
    let mut terminal = Terminal::new(backend)?;

    let app = Arc::new(Mutex::new(App::new(cli_path)));
    let run_result = run_app(&mut terminal, app.clone()).await;

    // Restore terminal
    disable_raw_mode()?;
    execute!(
        terminal.backend_mut(),
        LeaveAlternateScreen,
        DisableMouseCapture
    )?;
    terminal.show_cursor()?;

    if let Err(err) = run_result {
        println!("Error: {}", err);
    }

    Ok(())
}

async fn run_app<B: Backend>(
    terminal: &mut Terminal<B>,
    app: Arc<Mutex<App>>,
) -> io::Result<()> {
    loop {
        terminal.draw(|f| draw_ui(f, &app))?;

        if event::poll(Duration::from_millis(100))? {
            if let Event::Key(key) = event::read()? {
                let mut app_lock = app.lock().unwrap();

                // Global quit on Esc
                if key.code == KeyCode::Esc {
                    return Ok(());
                }

                match app_lock.active_screen {
                    ActiveScreen::Setup => {
                        match key.code {
                            KeyCode::Tab => {
                                app_lock.selected_setup_field = match app_lock.selected_setup_field {
                                    SetupField::Url => SetupField::Preset,
                                    SetupField::Preset => SetupField::HtmlReport,
                                    SetupField::HtmlReport => SetupField::Url,
                                };
                            }
                            KeyCode::Down => {
                                app_lock.selected_setup_field = match app_lock.selected_setup_field {
                                    SetupField::Url => SetupField::Preset,
                                    SetupField::Preset => SetupField::HtmlReport,
                                    SetupField::HtmlReport => SetupField::Url,
                                };
                            }
                            KeyCode::Up => {
                                app_lock.selected_setup_field = match app_lock.selected_setup_field {
                                    SetupField::Url => SetupField::HtmlReport,
                                    SetupField::Preset => SetupField::Url,
                                    SetupField::HtmlReport => SetupField::Preset,
                                };
                            }
                            KeyCode::Char(c) => {
                                match app_lock.selected_setup_field {
                                    SetupField::Url => app_lock.url_input.push(c),
                                    SetupField::Preset => {
                                        if c == '1' || c == 'b' { app_lock.preset_index = 0; }
                                        else if c == '2' || c == 'a' { app_lock.preset_index = 1; }
                                        else if c == '3' || c == 's' { app_lock.preset_index = 2; }
                                    }
                                    SetupField::HtmlReport => app_lock.html_report_path.push(c),
                                }
                            }
                            KeyCode::Backspace => {
                                match app_lock.selected_setup_field {
                                    SetupField::Url => { app_lock.url_input.pop(); }
                                    SetupField::Preset => {}
                                    SetupField::HtmlReport => { app_lock.html_report_path.pop(); }
                                }
                            }
                            KeyCode::Left => {
                                if app_lock.selected_setup_field == SetupField::Preset && app_lock.preset_index > 0 {
                                    app_lock.preset_index -= 1;
                                }
                            }
                            KeyCode::Right => {
                                if app_lock.selected_setup_field == SetupField::Preset && app_lock.preset_index < 2 {
                                    app_lock.preset_index += 1;
                                }
                            }
                            KeyCode::Enter => {
                                // Start audit process asynchronously
                                app_lock.active_screen = ActiveScreen::Loading;
                                app_lock.loading_status = "Launching Playwright browser engine...".to_string();
                                
                                let url = app_lock.url_input.clone();
                                let preset = match app_lock.preset_index {
                                    0 => "basic",
                                    1 => "advanced",
                                    _ => "strict",
                                }.to_string();
                                let html_path = app_lock.html_report_path.clone();
                                let cli_path = app_lock.cli_path.clone();

                                let app_clone = app.clone();
                                tokio::spawn(async move {
                                    run_audit_process(app_clone, cli_path, url, preset, html_path).await;
                                });
                            }
                            _ => {}
                        }
                    }
                    ActiveScreen::Loading => {
                        // Let background thread work, keyboard events ignored except Esc
                    }
                    ActiveScreen::Dashboard => {
                        match key.code {
                            KeyCode::Left | KeyCode::BackTab => {
                                app_lock.active_panel_right = false;
                            }
                            KeyCode::Right | KeyCode::Tab => {
                                app_lock.active_panel_right = true;
                            }
                            KeyCode::Down => {
                                if app_lock.active_panel_right {
                                    if let Some(curr) = app_lock.check_list_state.selected() {
                                        if let Some((_, checks)) = app_lock.categories.get(app_lock.category_list_state.selected().unwrap_or(0)) {
                                            if curr + 1 < checks.len() {
                                                app_lock.check_list_state.select(Some(curr + 1));
                                            }
                                        }
                                    }
                                } else {
                                    if let Some(curr) = app_lock.category_list_state.selected() {
                                        if curr + 1 < app_lock.categories.len() {
                                            app_lock.category_list_state.select(Some(curr + 1));
                                            app_lock.check_list_state.select(Some(0));
                                        }
                                    }
                                }
                            }
                            KeyCode::Up => {
                                if app_lock.active_panel_right {
                                    if let Some(curr) = app_lock.check_list_state.selected() {
                                        if curr > 0 {
                                            app_lock.check_list_state.select(Some(curr - 1));
                                        }
                                    }
                                } else {
                                    if let Some(curr) = app_lock.category_list_state.selected() {
                                        if curr > 0 {
                                            app_lock.category_list_state.select(Some(curr - 1));
                                            app_lock.check_list_state.select(Some(0));
                                        }
                                    }
                                }
                            }
                            KeyCode::Char('q') | KeyCode::Char('Q') => {
                                app_lock.active_screen = ActiveScreen::Setup;
                                app_lock.report = None;
                                app_lock.categories.clear();
                            }
                            _ => {}
                        }
                    }
                    ActiveScreen::Error(_) => {
                        if key.code == KeyCode::Enter || key.code == KeyCode::Char('q') {
                            app_lock.active_screen = ActiveScreen::Setup;
                        }
                    }
                }
            }
        }
    }
}

// ─── Background Node CLI Process ──────────────────────────────────────────────

async fn run_audit_process(
    app: Arc<Mutex<App>>,
    cli_path: String,
    url: String,
    preset: String,
    html_path: String,
) {
    {
        let mut app_lock = app.lock().unwrap();
        app_lock.loading_status = format!("Executing SEO audit for {}...", url);
    }

    let mut cmd = Command::new("node");
    cmd.arg(cli_path)
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
            let output = child.wait_with_output().await;
            match output {
                Ok(out) => {
                    if out.status.success() {
                        let stdout_str = String::from_utf8_lossy(&out.stdout);
                        // Find the start of the JSON block to handle any warnings
                        if let Some(json_start) = stdout_str.find('{') {
                            let json_part = &stdout_str[json_start..];
                            match serde_json::from_str::<SEOReport>(json_part) {
                                Ok(parsed_report) => {
                                    let mut app_lock = app.lock().unwrap();
                                    app_lock.report = Some(parsed_report);
                                    app_lock.populate_categories();
                                    app_lock.active_screen = ActiveScreen::Dashboard;
                                }
                                Err(err) => {
                                    let mut app_lock = app.lock().unwrap();
                                    app_lock.active_screen = ActiveScreen::Error(format!(
                                        "Failed to parse report JSON structure: {}. Output was: {}",
                                        err,
                                        stdout_str.chars().take(200).collect::<String>()
                                    ));
                                }
                            }
                        } else {
                            let mut app_lock = app.lock().unwrap();
                            app_lock.active_screen = ActiveScreen::Error(format!(
                                "No JSON output block found. Process stdout: {}",
                                stdout_str.chars().take(200).collect::<String>()
                            ));
                        }
                    } else {
                        let stderr_str = String::from_utf8_lossy(&out.stderr);
                        let mut app_lock = app.lock().unwrap();
                        app_lock.active_screen = ActiveScreen::Error(format!(
                            "Audit process failed. Error: {}",
                            stderr_str.chars().take(300).collect::<String>()
                        ));
                    }
                }
                Err(err) => {
                    let mut app_lock = app.lock().unwrap();
                    app_lock.active_screen = ActiveScreen::Error(format!("Audit run error: {}", err));
                }
            }
        }
        Err(err) => {
            let mut app_lock = app.lock().unwrap();
            app_lock.active_screen = ActiveScreen::Error(format!(
                "Failed to spawn node processes. Ensure node is on PATH and dist/cli.js exists. Error: {}",
                err
            ));
        }
    }
}

// ─── Drawing UI ───────────────────────────────────────────────────────────────

fn draw_ui(f: &mut Frame, app: &Arc<Mutex<App>>) {
    let app_lock = app.lock().unwrap();
    let size = f.area();

    // Clear background
    f.render_widget(Block::default().style(Style::default().bg(Color::Rgb(15, 17, 23))), size);

    match &app_lock.active_screen {
        ActiveScreen::Setup => draw_setup_screen(f, size, &app_lock),
        ActiveScreen::Loading => draw_loading_screen(f, size, &app_lock),
        ActiveScreen::Dashboard => draw_dashboard_screen(f, size, &app_lock),
        ActiveScreen::Error(msg) => draw_error_screen(f, size, &msg),
    }
}

fn draw_setup_screen(f: &mut Frame, area: Rect, app: &App) {
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .margin(2)
        .constraints([
            Constraint::Length(3), // Header
            Constraint::Length(10), // Config inputs
            Constraint::Min(3),    // Info panel
            Constraint::Length(3), // Footer
        ])
        .split(area);

    // Title Block
    let header_widget = Paragraph::new("e2e-seo - Terminal User Interface")
        .style(Style::default().fg(Color::Rgb(139, 92, 246)).add_modifier(Modifier::BOLD))
        .block(Block::default().borders(Borders::BOTTOM).border_style(Style::default().fg(Color::Rgb(46, 51, 71))));
    f.render_widget(header_widget, chunks[0]);

    // Setup input panels
    let form_chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(3), // URL Input
            Constraint::Length(3), // Preset Select
            Constraint::Length(3), // HTML output
        ])
        .split(chunks[1]);

    // URL Field
    let url_style = if app.selected_setup_field == SetupField::Url {
        Style::default().fg(Color::Rgb(139, 92, 246))
    } else {
        Style::default().fg(Color::Rgb(136, 146, 164))
    };
    let url_widget = Paragraph::new(app.url_input.clone())
        .block(Block::default()
            .borders(Borders::ALL)
            .border_style(url_style)
            .title(" Target URL (Press Enter to start audit) "));
    f.render_widget(url_widget, form_chunks[0]);

    // Preset Field
    let preset_style = if app.selected_setup_field == SetupField::Preset {
        Style::default().fg(Color::Rgb(139, 92, 246))
    } else {
        Style::default().fg(Color::Rgb(136, 146, 164))
    };
    let presets = ["Basic Audit", "Advanced (Heatmap)", "Strict Audit"];
    let mut preset_spans = Vec::new();
    for (i, p) in presets.iter().enumerate() {
        if i == app.preset_index {
            preset_spans.push(Span::styled(
                format!(" [ {} ] ", p),
                Style::default().fg(Color::Rgb(22, 197, 94)).add_modifier(Modifier::BOLD),
            ));
        } else {
            preset_spans.push(Span::raw(format!("  {}  ", p)));
        }
    }
    let preset_widget = Paragraph::new(Line::from(preset_spans))
        .block(Block::default()
            .borders(Borders::ALL)
            .border_style(preset_style)
            .title(" Audit Preset (Left/Right to choose) "));
    f.render_widget(preset_widget, form_chunks[1]);

    // HTML Output Field
    let html_style = if app.selected_setup_field == SetupField::HtmlReport {
        Style::default().fg(Color::Rgb(139, 92, 246))
    } else {
        Style::default().fg(Color::Rgb(136, 146, 164))
    };
    let html_widget = Paragraph::new(app.html_report_path.clone())
        .block(Block::default()
            .borders(Borders::ALL)
            .border_style(html_style)
            .title(" Visual HTML Report Save Path (Leave empty to skip) "));
    f.render_widget(html_widget, form_chunks[2]);

    // Instructions
    let instructions = "Navigation:\n\
                        - Tab / Up / Down: Move focus between input panels\n\
                        - Left / Right: Choose preset type (Basic / Advanced / Strict)\n\
                        - Enter: Launch browser engine and run SEO Audit\n\
                        - Esc: Quit application";
    let info_widget = Paragraph::new(instructions)
        .style(Style::default().fg(Color::Rgb(136, 146, 164)))
        .block(Block::default()
            .borders(Borders::ALL)
            .border_style(Style::default().fg(Color::Rgb(46, 51, 71)))
            .title(" Navigation & Help "));
    f.render_widget(info_widget, chunks[2]);

    // Footer
    let footer_widget = Paragraph::new("e2e-seo terminal runner")
        .style(Style::default().fg(Color::Rgb(71, 85, 105)));
    f.render_widget(footer_widget, chunks[3]);
}

fn draw_loading_screen(f: &mut Frame, area: Rect, app: &App) {
    let popup_area = Rect {
        x: area.x + (area.width / 4),
        y: area.y + (area.height / 3),
        width: area.width / 2,
        height: 6,
    };

    f.render_widget(Block::default().style(Style::default().bg(Color::Rgb(26, 29, 39))), popup_area);

    let progress_widget = Paragraph::new(format!(
        "\n  {}\n  Please wait...",
        app.loading_status
    ))
    .block(Block::default()
        .borders(Borders::ALL)
        .border_style(Style::default().fg(Color::Rgb(245, 158, 11)))
        .title(" Running Audit "));

    f.render_widget(progress_widget, popup_area);
}

fn draw_error_screen(f: &mut Frame, area: Rect, msg: &str) {
    let popup_area = Rect {
        x: area.x + (area.width / 6),
        y: area.y + (area.height / 4),
        width: (area.width * 2) / 3,
        height: 12,
    };

    f.render_widget(Block::default().style(Style::default().bg(Color::Rgb(26, 29, 39))), popup_area);

    let error_widget = Paragraph::new(format!(
        "\n  Error Details:\n  {}\n\n  Press Enter/Q to return to Setup.",
        msg
    ))
    .wrap(Wrap { trim: true })
    .block(Block::default()
        .borders(Borders::ALL)
        .border_style(Style::default().fg(Color::Rgb(239, 68, 68)))
        .title(" Audit Failed "));

    f.render_widget(error_widget, popup_area);
}

fn draw_dashboard_screen(f: &mut Frame, area: Rect, app: &App) {
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .margin(1)
        .constraints([
            Constraint::Length(5), // Top stats block
            Constraint::Min(10),   // Grid results
            Constraint::Length(2), // Legend footer
        ])
        .split(area);

    // Render Stats block
    if let Some(r) = &app.report {
        let stats_chunks = Layout::default()
            .direction(Direction::Horizontal)
            .constraints([
                Constraint::Percentage(50), // URL & Grade
                Constraint::Percentage(50), // Score / Pass rate / Total
            ])
            .split(chunks[0]);

        let score_color = if r.score >= 80 { Color::Rgb(34, 197, 94) }
            else if r.score >= 60 { Color::Rgb(245, 158, 11) }
            else { Color::Rgb(239, 68, 68) };

        // Left stat panel
        let left_spans = vec![
            Line::from(vec![
                Span::raw("Audited URL: "),
                Span::styled(r.url.clone(), Style::default().fg(Color::Rgb(139, 92, 246)).add_modifier(Modifier::BOLD)),
            ]),
            Line::from(vec![
                Span::raw("Grade: "),
                Span::styled(app.get_grade().to_string(), Style::default().fg(score_color).add_modifier(Modifier::BOLD)),
            ]),
        ];
        let stats_left = Paragraph::new(left_spans)
            .block(Block::default()
                .borders(Borders::ALL)
                .border_style(Style::default().fg(Color::Rgb(46, 51, 71)))
                .title(" Audit Details "));
        f.render_widget(stats_left, stats_chunks[0]);

        // Right stat panel
        let right_spans = vec![
            Line::from(vec![
                Span::raw("SEO Score: "),
                Span::styled(format!("{}/100", r.score), Style::default().fg(score_color).add_modifier(Modifier::BOLD)),
            ]),
            Line::from(vec![
                Span::raw("Summary: "),
                Span::styled(format!("{} passed", r.summary.passed), Style::default().fg(Color::Rgb(34, 197, 94))),
                Span::raw(" / "),
                Span::styled(format!("{} failed", r.summary.failed), Style::default().fg(Color::Rgb(239, 68, 68))),
                Span::raw(format!(" ({} total checks)", r.summary.total)),
            ]),
        ];
        let stats_right = Paragraph::new(right_spans)
            .block(Block::default()
                .borders(Borders::ALL)
                .border_style(Style::default().fg(Color::Rgb(46, 51, 71)))
                .title(" Statistics Summary "));
        f.render_widget(stats_right, stats_chunks[1]);
    }

    // Results grid split
    let grid_chunks = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([
            Constraint::Percentage(30), // Categories List
            Constraint::Percentage(70), // Checks detail list
        ])
        .split(chunks[1]);

    // 1. Categories Panel
    let cat_border_style = if !app.active_panel_right {
        Style::default().fg(Color::Rgb(139, 92, 246))
    } else {
        Style::default().fg(Color::Rgb(46, 51, 71))
    };

    let categories_items: Vec<ListItem> = app.categories.iter().map(|(name, checks)| {
        let failed_count = checks.iter().filter(|c| !c.passed).count();
        let name_span = if failed_count > 0 {
            Span::styled(format!("{} ({} fail)", name, failed_count), Style::default().fg(Color::Rgb(239, 68, 68)))
        } else {
            Span::raw(name.clone())
        };
        ListItem::new(name_span)
    }).collect();

    let categories_list = List::new(categories_items)
        .block(Block::default()
            .borders(Borders::ALL)
            .border_style(cat_border_style)
            .title(" Categories "))
        .highlight_style(Style::default().bg(Color::Rgb(34, 38, 58)).add_modifier(Modifier::BOLD))
        .highlight_symbol("> ");

    // We need to render lists using states. To preserve mutability without interior mutability, 
    // we use a copy of list_state to render and update.
    let mut cat_state_clone = app.category_list_state.clone();
    f.render_stateful_widget(categories_list, grid_chunks[0], &mut cat_state_clone);

    // 2. Checks Details Panel
    let checks_border_style = if app.active_panel_right {
        Style::default().fg(Color::Rgb(139, 92, 246))
    } else {
        Style::default().fg(Color::Rgb(46, 51, 71))
    };

    let active_cat_idx = app.category_list_state.selected().unwrap_or(0);
    if let Some((cat_name, checks)) = app.categories.get(active_cat_idx) {
        let check_items: Vec<ListItem> = checks.iter().map(|check| {
            let icon = if check.passed { "[Pass]" } else { "[Fail]" };
            let color = if check.passed { Color::Rgb(34, 197, 94) } else { Color::Rgb(239, 68, 68) };
            
            let mut line_spans = vec![
                Span::styled(format!("{} ", icon), Style::default().fg(color).add_modifier(Modifier::BOLD)),
                Span::raw(check.message.clone()),
            ];

            if !check.passed {
                if let Some(sev) = &check.severity {
                    let badge_color = match sev.as_str() {
                        "error" => Color::Rgb(239, 68, 68),
                        "warning" => Color::Rgb(245, 158, 11),
                        _ => Color::Rgb(59, 130, 246),
                    };
                    line_spans.push(Span::raw(" ("));
                    line_spans.push(Span::styled(sev.to_uppercase(), Style::default().fg(badge_color).add_modifier(Modifier::BOLD)));
                    line_spans.push(Span::raw(")"));
                }
            }

            ListItem::new(Line::from(line_spans))
        }).collect();

        let checks_list = List::new(check_items)
            .block(Block::default()
                .borders(Borders::ALL)
                .border_style(checks_border_style)
                .title(format!(" {} Checks ", cat_name)))
            .highlight_style(Style::default().bg(Color::Rgb(34, 38, 58)))
            .highlight_symbol("> ");

        let mut check_state_clone = app.check_list_state.clone();
        f.render_stateful_widget(checks_list, grid_chunks[1], &mut check_state_clone);
    } else {
        let empty_panel = Paragraph::new("No checker runs found.")
            .block(Block::default().borders(Borders::ALL).border_style(checks_border_style).title(" Checks Detail "));
        f.render_widget(empty_panel, grid_chunks[1]);
    }

    // Legend Footer
    let footer_text = "Navigate: Tab/Shift-Tab: Switch list panel  |  Up/Down: Scroll items  |  Q: Setup Screen  |  Esc: Exit";
    let footer_widget = Paragraph::new(footer_text)
        .style(Style::default().fg(Color::Rgb(136, 146, 164)));
    f.render_widget(footer_widget, chunks[2]);
}
