use super::canvas::{
    Canvas, PageDecoration, TextAlign, TextStyle, COLOR_BODY, COLOR_MUTED, COLOR_NAVY,
    COLOR_SLATE_300, COLOR_SLATE_400, COLOR_SLATE_900, COLOR_WHITE, MARGIN_X, PAGE_WIDTH,
    SIDEBAR_WIDTH, TOP_Y,
};
use super::content::{
    CvContent, CvTemplate, EducationEntry, ExperienceEntry, ExportLabels, ProjectEntry,
};

const TITLE: TextStyle = TextStyle {
    font: "F2",
    size: 21.0,
    line_height: 26.0,
    color: COLOR_BODY,
    align: TextAlign::Left,
    indent: 0.0,
};

const HEADLINE: TextStyle = TextStyle {
    font: "F1",
    size: 11.0,
    line_height: 14.0,
    color: COLOR_MUTED,
    align: TextAlign::Left,
    indent: 0.0,
};

const CONTACT: TextStyle = TextStyle {
    font: "F1",
    size: 9.0,
    line_height: 12.0,
    color: COLOR_MUTED,
    align: TextAlign::Left,
    indent: 0.0,
};

const SECTION: TextStyle = TextStyle {
    font: "F2",
    size: 8.5,
    line_height: 14.0,
    color: COLOR_MUTED,
    align: TextAlign::Left,
    indent: 0.0,
};

const BODY: TextStyle = TextStyle {
    font: "F1",
    size: 10.5,
    line_height: 14.0,
    color: COLOR_BODY,
    align: TextAlign::Left,
    indent: 0.0,
};

const HEADING: TextStyle = TextStyle {
    font: "F2",
    size: 10.5,
    line_height: 14.0,
    color: COLOR_BODY,
    align: TextAlign::Left,
    indent: 0.0,
};

const META: TextStyle = TextStyle {
    font: "F1",
    size: 9.0,
    line_height: 12.0,
    color: COLOR_MUTED,
    align: TextAlign::Left,
    indent: 0.0,
};

const BULLET: TextStyle = TextStyle {
    font: "F1",
    size: 10.5,
    line_height: 14.0,
    color: COLOR_BODY,
    align: TextAlign::Left,
    indent: 12.0,
};

#[derive(Clone, Copy)]
enum HeaderStyle {
    Classic,
    Modern,
    Minimal,
}

#[derive(Clone, Copy)]
enum SectionStyle {
    Classic,
    Modern,
    Minimal,
    Executive,
}

pub fn render_template(
    template: CvTemplate,
    content: &CvContent,
    labels: &ExportLabels,
) -> Vec<String> {
    match template {
        CvTemplate::Classic => render_classic(content, labels),
        CvTemplate::Modern => render_modern(content, labels),
        CvTemplate::Sidebar => render_sidebar(content, labels),
        CvTemplate::Minimal => render_minimal(content, labels),
        CvTemplate::Executive => render_executive(content, labels),
    }
}

fn render_classic(content: &CvContent, labels: &ExportLabels) -> Vec<String> {
    let mut canvas = Canvas::new(MARGIN_X, PAGE_WIDTH - MARGIN_X);
    draw_header(&mut canvas, content, HeaderStyle::Classic);
    draw_main_sections(&mut canvas, content, labels, SectionStyle::Classic, true);
    canvas.into_streams()
}

fn render_modern(content: &CvContent, labels: &ExportLabels) -> Vec<String> {
    let mut canvas = Canvas::new(MARGIN_X, PAGE_WIDTH - MARGIN_X);
    draw_header(&mut canvas, content, HeaderStyle::Modern);
    draw_main_sections(&mut canvas, content, labels, SectionStyle::Modern, true);
    canvas.into_streams()
}

fn render_minimal(content: &CvContent, labels: &ExportLabels) -> Vec<String> {
    let mut canvas = Canvas::new(MARGIN_X, PAGE_WIDTH - MARGIN_X);
    draw_header(&mut canvas, content, HeaderStyle::Minimal);
    draw_main_sections(&mut canvas, content, labels, SectionStyle::Minimal, true);
    canvas.into_streams()
}

fn render_executive(content: &CvContent, labels: &ExportLabels) -> Vec<String> {
    let mut canvas = Canvas::new(MARGIN_X, PAGE_WIDTH - MARGIN_X);
    draw_executive_header(&mut canvas, content);
    draw_main_sections(
        &mut canvas,
        content,
        labels,
        SectionStyle::Executive,
        true,
    );
    canvas.into_streams()
}

fn render_sidebar(content: &CvContent, labels: &ExportLabels) -> Vec<String> {
    let main_left = MARGIN_X + SIDEBAR_WIDTH + 14.0;
    let mut canvas = Canvas::with_decoration(
        main_left,
        PAGE_WIDTH - MARGIN_X,
        PageDecoration::Sidebar,
    );
    draw_sidebar_page_one(&mut canvas, content, labels);
    draw_main_sections(
        &mut canvas,
        content,
        labels,
        SectionStyle::Classic,
        false,
    );
    canvas.into_streams()
}

fn draw_sidebar_page_one(canvas: &mut Canvas, content: &CvContent, labels: &ExportLabels) {
    let saved_left = canvas.left;
    let saved_right = canvas.right;
    canvas.left = 18.0;
    canvas.right = SIDEBAR_WIDTH - 12.0;
    canvas.set_y(TOP_Y);

    canvas.draw_text(
        &content.name,
        TextStyle {
            size: 16.0,
            line_height: 20.0,
            color: COLOR_WHITE,
            ..TITLE
        },
    );
    if !content.headline.is_empty() {
        canvas.draw_text(
            &content.headline,
            HEADLINE.with_color(COLOR_SLATE_300),
        );
    }
    if !content.contact_line.is_empty() {
        canvas.draw_text(
            &content.contact_line,
            CONTACT.with_color(COLOR_SLATE_400),
        );
    }
    if !content.skills.is_empty() {
        canvas.spacer(8.0);
        draw_sidebar_section(canvas, &labels.skills, &content.skills.join(" · "));
    }
    if !content.languages.is_empty() {
        canvas.spacer(8.0);
        draw_sidebar_section(
            canvas,
            &labels.languages,
            &content.languages.join(" · "),
        );
    }

    canvas.left = saved_left;
    canvas.right = saved_right;
    canvas.set_y(TOP_Y);
}

fn draw_sidebar_section(canvas: &mut Canvas, title: &str, body: &str) {
    canvas.draw_text(
        title,
        TextStyle {
            size: 7.5,
            line_height: 11.0,
            color: COLOR_SLATE_400,
            ..SECTION
        },
    );
    canvas.draw_text(body, BODY.with_color(COLOR_SLATE_300));
}

fn draw_executive_header(canvas: &mut Canvas, content: &CvContent) {
    let header_height = 88.0;
    canvas.fill_rect(
        0.0,
        TOP_Y - header_height,
        PAGE_WIDTH,
        header_height,
        COLOR_SLATE_900,
    );
    canvas.set_y(TOP_Y - 24.0);
    canvas.draw_text(
        &content.name,
        TextStyle {
            size: 24.0,
            line_height: 28.0,
            color: COLOR_WHITE,
            ..TITLE
        },
    );
    if !content.headline.is_empty() {
        canvas.draw_text(
            &content.headline,
            HEADLINE.with_color(COLOR_SLATE_300),
        );
    }
    if !content.contact_line.is_empty() {
        canvas.draw_text(
            &content.contact_line,
            CONTACT.with_color(COLOR_SLATE_400),
        );
    }
    canvas.set_y(TOP_Y - header_height - 12.0);
}

fn draw_header(canvas: &mut Canvas, content: &CvContent, style: HeaderStyle) {
    let title = match style {
        HeaderStyle::Classic => TITLE.with_align(TextAlign::Center),
        HeaderStyle::Modern => TextStyle {
            size: 24.0,
            line_height: 28.0,
            ..TITLE
        },
        HeaderStyle::Minimal => TextStyle {
            font: "F1",
            size: 24.0,
            line_height: 28.0,
            ..TITLE
        },
    };
    let headline = match style {
        HeaderStyle::Classic => HEADLINE.with_align(TextAlign::Center),
        _ => HEADLINE,
    };
    let contact = match style {
        HeaderStyle::Classic => CONTACT.with_align(TextAlign::Center),
        _ => CONTACT,
    };

    canvas.draw_text(&content.name, title);
    if !content.headline.is_empty() {
        canvas.draw_text(&content.headline, headline);
    }
    if !content.contact_line.is_empty() {
        canvas.draw_text(&content.contact_line, contact);
    }

    if matches!(style, HeaderStyle::Modern) {
        canvas.stroke_line(
            canvas.left,
            canvas.y + 4.0,
            canvas.right,
            canvas.y + 4.0,
            COLOR_NAVY,
            1.5,
        );
        canvas.spacer(10.0);
    } else {
        canvas.spacer(6.0);
    }
}

fn draw_main_sections(
    canvas: &mut Canvas,
    content: &CvContent,
    labels: &ExportLabels,
    style: SectionStyle,
    include_contact_sections: bool,
) {
    if !content.summary.is_empty() {
        draw_section_title(canvas, &labels.summary, style);
        canvas.draw_text(&content.summary, BODY);
        canvas.spacer(4.0);
    }

    if include_contact_sections && !content.skills.is_empty() {
        draw_section_title(canvas, &labels.skills, style);
        canvas.draw_text(&content.skills.join(" · "), BODY);
        canvas.spacer(4.0);
    }

    if !content.experience.is_empty() {
        draw_section_title(canvas, &labels.experience, style);
        for item in &content.experience {
            draw_experience(canvas, item);
        }
        canvas.spacer(4.0);
    }

    if !content.projects.is_empty() {
        draw_section_title(canvas, &labels.projects, style);
        for item in &content.projects {
            draw_project(canvas, item);
        }
        canvas.spacer(4.0);
    }

    if !content.education.is_empty() {
        draw_section_title(canvas, &labels.education, style);
        for item in &content.education {
            draw_education(canvas, item);
        }
        canvas.spacer(4.0);
    }

    if include_contact_sections && !content.languages.is_empty() {
        draw_section_title(canvas, &labels.languages, style);
        canvas.draw_text(&content.languages.join(" · "), BODY);
    }
}

fn draw_section_title(canvas: &mut Canvas, title: &str, style: SectionStyle) {
    canvas.spacer(6.0);
    match style {
        SectionStyle::Classic => {
            let y = canvas.y;
            canvas.draw_text(&title.to_uppercase(), SECTION);
            canvas.stroke_line(canvas.left, y - 12.0, canvas.right, y - 12.0, COLOR_MUTED, 0.75);
        }
        SectionStyle::Modern => {
            let y = canvas.y;
            canvas.draw_text(
                title,
                TextStyle {
                    size: 10.0,
                    line_height: 14.0,
                    color: COLOR_NAVY,
                    ..SECTION
                },
            );
            canvas.stroke_line(canvas.left, y - 12.0, canvas.right, y - 12.0, COLOR_NAVY, 1.5);
        }
        SectionStyle::Minimal => {
            canvas.draw_text(
                title,
                TextStyle {
                    size: 10.0,
                    line_height: 14.0,
                    color: COLOR_MUTED,
                    ..SECTION
                },
            );
        }
        SectionStyle::Executive => {
            let y = canvas.y;
            canvas.fill_rect(canvas.left, y - 10.0, 3.0, 12.0, COLOR_SLATE_900);
            canvas.draw_text(
                &title.to_uppercase(),
                TextStyle {
                    size: 9.0,
                    line_height: 14.0,
                    color: COLOR_BODY,
                    indent: 8.0,
                    ..SECTION
                },
            );
        }
    }
}

fn draw_experience(canvas: &mut Canvas, item: &ExperienceEntry) {
    let heading = join_title_company(&item.title, &item.company);
    canvas.draw_heading_row(&heading, &item.date_range, HEADING, META);
    let meta = join_non_empty(&[item.location.clone(), item.technologies.clone()]);
    if !meta.is_empty() {
        canvas.draw_text(&meta, META);
    }
    draw_bullets(canvas, &item.bullets);
    canvas.spacer(4.0);
}

fn draw_project(canvas: &mut Canvas, item: &ProjectEntry) {
    canvas.draw_heading_row(&item.name, &item.role, HEADING, META);
    let meta = join_non_empty(&[item.url.clone(), item.technologies.clone()]);
    if !meta.is_empty() {
        canvas.draw_text(&meta, META);
    }
    if !item.description.is_empty() {
        canvas.draw_text(&item.description, BODY);
    }
    draw_bullets(canvas, &item.bullets);
    canvas.spacer(4.0);
}

fn draw_education(canvas: &mut Canvas, item: &EducationEntry) {
    canvas.draw_heading_row(&item.degree, &item.date_range, HEADING, META);
    let meta = join_non_empty(&[item.institution.clone(), item.location.clone()]);
    if !meta.is_empty() {
        canvas.draw_text(&meta, META);
    }
    draw_bullets(canvas, &item.details);
    canvas.spacer(4.0);
}

fn draw_bullets(canvas: &mut Canvas, bullets: &[String]) {
    for bullet in bullets {
        canvas.draw_text(&format!("• {bullet}"), BULLET);
    }
}

fn join_title_company(title: &str, company: &str) -> String {
    if company.is_empty() {
        title.to_string()
    } else if title.is_empty() {
        company.to_string()
    } else {
        format!("{title} · {company}")
    }
}

fn join_non_empty(values: &[String]) -> String {
    values
        .iter()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
        .collect::<Vec<_>>()
        .join(" · ")
}
