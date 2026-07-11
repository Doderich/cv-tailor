pub const PAGE_WIDTH: f32 = 595.0;
pub const PAGE_HEIGHT: f32 = 842.0;
pub const MARGIN_X: f32 = 50.0;
pub const TOP_Y: f32 = 792.0;
pub const BOTTOM_Y: f32 = 50.0;
pub const SIDEBAR_WIDTH: f32 = 192.0;

#[derive(Clone, Copy)]
pub struct Rgb(pub f32, pub f32, pub f32);

pub const COLOR_BODY: Rgb = Rgb(22.0 / 255.0, 24.0 / 255.0, 29.0 / 255.0);
pub const COLOR_MUTED: Rgb = Rgb(107.0 / 255.0, 113.0 / 255.0, 128.0 / 255.0);
pub const COLOR_NAVY: Rgb = Rgb(30.0 / 255.0, 64.0 / 255.0, 175.0 / 255.0);
pub const COLOR_SLATE_900: Rgb = Rgb(15.0 / 255.0, 23.0 / 255.0, 42.0 / 255.0);
pub const COLOR_SLATE_300: Rgb = Rgb(203.0 / 255.0, 213.0 / 255.0, 225.0 / 255.0);
pub const COLOR_SLATE_400: Rgb = Rgb(148.0 / 255.0, 163.0 / 255.0, 184.0 / 255.0);
pub const COLOR_WHITE: Rgb = Rgb(1.0, 1.0, 1.0);

#[derive(Clone, Copy)]
pub enum TextAlign {
    Left,
    Center,
}

#[derive(Clone, Copy)]
pub struct TextStyle {
    pub font: &'static str,
    pub size: f32,
    pub line_height: f32,
    pub color: Rgb,
    pub align: TextAlign,
    pub indent: f32,
}

impl TextStyle {
    pub const fn with_color(self, color: Rgb) -> Self {
        Self { color, ..self }
    }

    pub const fn with_align(self, align: TextAlign) -> Self {
        Self { align, ..self }
    }
}

pub enum PageDecoration {
    None,
    Sidebar,
}

pub struct Canvas {
    pub pages: Vec<String>,
    pub stream: String,
    pub y: f32,
    pub left: f32,
    pub right: f32,
    page_count: usize,
    decoration: PageDecoration,
}

impl Canvas {
    pub fn new(left: f32, right: f32) -> Self {
        Self::with_decoration(left, right, PageDecoration::None)
    }

    pub fn with_decoration(left: f32, right: f32, decoration: PageDecoration) -> Self {
        Self {
            pages: Vec::new(),
            stream: String::new(),
            y: TOP_Y,
            left,
            right,
            page_count: 1,
            decoration,
        }
    }

    pub fn content_width(&self) -> f32 {
        (self.right - self.left).max(40.0)
    }

    pub fn set_y(&mut self, y: f32) {
        self.y = y;
    }

    pub fn ensure_space(&mut self, height: f32) {
        if self.y - height < BOTTOM_Y {
            self.finish_page();
            self.start_page();
        }
    }

    pub fn finish_page(&mut self) {
        if !self.stream.is_empty() {
            self.pages.push(std::mem::take(&mut self.stream));
        }
    }

    pub fn start_page(&mut self) {
        self.page_count += 1;
        self.y = TOP_Y;
        self.paint_page_decoration();
    }

    fn paint_page_decoration(&mut self) {
        if matches!(self.decoration, PageDecoration::Sidebar) {
            self.fill_rect(
                0.0,
                BOTTOM_Y,
                SIDEBAR_WIDTH,
                PAGE_HEIGHT - BOTTOM_Y,
                COLOR_SLATE_900,
            );
        }
    }

    pub fn fill_rect(&mut self, x: f32, y: f32, width: f32, height: f32, color: Rgb) {
        self.stream.push_str(&format!(
            "{} {} {} rg {} {} {} {} re f\n",
            color.0, color.1, color.2, x, y, width, height
        ));
    }

    pub fn stroke_line(&mut self, x1: f32, y1: f32, x2: f32, y2: f32, color: Rgb, width: f32) {
        self.stream.push_str(&format!(
            "{} {} {} RG {} w {} {} m {} {} l S\n",
            color.0, color.1, color.2, width, x1, y1, x2, y2
        ));
    }

    pub fn draw_text(&mut self, text: &str, style: TextStyle) {
        if text.trim().is_empty() {
            return;
        }

        for line in wrap_text(text, style.size, style.indent, self.content_width()) {
            self.ensure_space(style.line_height);
            let x = match style.align {
                TextAlign::Left => self.left + style.indent,
                TextAlign::Center => {
                    let width = text_width_approx(&line, style.size);
                    ((self.left + self.right) / 2.0) - (width / 2.0)
                }
            };
            write_text(
                &mut self.stream,
                style.font,
                style.size,
                x,
                self.y,
                &line,
                style.color,
            );
            self.y -= style.line_height;
        }
    }

    pub fn draw_heading_row(
        &mut self,
        left_text: &str,
        right_text: &str,
        left_style: TextStyle,
        right_style: TextStyle,
    ) {
        self.ensure_space(left_style.line_height);
        write_text(
            &mut self.stream,
            left_style.font,
            left_style.size,
            self.left,
            self.y,
            left_text,
            left_style.color,
        );
        if !right_text.is_empty() {
            let width = text_width_approx(right_text, right_style.size);
            write_text(
                &mut self.stream,
                right_style.font,
                right_style.size,
                self.right - width,
                self.y,
                right_text,
                right_style.color,
            );
        }
        self.y -= left_style.line_height;
    }

    pub fn spacer(&mut self, amount: f32) {
        self.ensure_space(amount);
        self.y -= amount;
    }

    pub fn into_streams(mut self) -> Vec<String> {
        self.paint_page_decoration();
        self.finish_page();
        if self.pages.is_empty() {
            self.pages.push(String::new());
        }
        self.pages
    }
}

pub fn encode_winansi(text: &str) -> Vec<u8> {
    text.chars()
        .map(|character| unicode_to_winansi_byte(character).unwrap_or(b'?'))
        .collect()
}

fn unicode_to_winansi_byte(character: char) -> Option<u8> {
    match character {
        '\t' => Some(b'\t'),
        c if c.is_ascii() && !c.is_control() => Some(c as u8),
        c if ('\u{00A0}'..='\u{00FF}').contains(&c) => Some(character as u8),
        '\u{0152}' => Some(0x8C),
        '\u{0153}' => Some(0x9C),
        '\u{0160}' => Some(0x8A),
        '\u{0161}' => Some(0x9A),
        '\u{0178}' => Some(0x9F),
        '\u{017D}' => Some(0x8E),
        '\u{017E}' => Some(0x9E),
        '\u{0192}' => Some(0x83),
        '\u{02C6}' => Some(0x88),
        '\u{02DC}' => Some(0x98),
        '\u{2013}' => Some(0x96),
        '\u{2014}' => Some(0x97),
        '\u{2018}' => Some(0x91),
        '\u{2019}' => Some(0x92),
        '\u{201A}' => Some(0x82),
        '\u{201C}' => Some(0x93),
        '\u{201D}' => Some(0x94),
        '\u{201E}' => Some(0x84),
        '\u{2020}' => Some(0x86),
        '\u{2021}' => Some(0x87),
        '\u{2022}' => Some(0x95),
        '\u{2026}' => Some(0x85),
        '\u{2030}' => Some(0x89),
        '\u{2039}' => Some(0x8B),
        '\u{203A}' => Some(0x9B),
        '\u{20AC}' => Some(0x80),
        '\u{2122}' => Some(0x99),
        c if c.is_whitespace() => Some(b' '),
        _ => None,
    }
}

fn format_pdf_hex_string(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02X}")).collect()
}

pub fn text_width_approx(text: &str, font_size: f32) -> f32 {
    text.chars().count() as f32 * font_size * 0.48
}

pub fn wrap_text(value: &str, font_size: f32, indent: f32, content_width: f32) -> Vec<String> {
    let usable_width = content_width - indent;
    let max_chars = (usable_width / (font_size * 0.48)).floor().max(18.0) as usize;
    let words = value.split_whitespace().collect::<Vec<_>>();

    if words.is_empty() {
        return vec![String::new()];
    }

    let mut lines = Vec::new();
    let mut current = String::new();

    for word in words {
        let extra_space = usize::from(!current.is_empty());
        if current.len() + word.len() + extra_space > max_chars && !current.is_empty() {
            lines.push(current);
            current = String::new();
        }

        if !current.is_empty() {
            current.push(' ');
        }
        current.push_str(word);
    }

    if !current.is_empty() {
        lines.push(current);
    }

    lines
}

fn write_text(
    stream: &mut String,
    font: &str,
    size: f32,
    x: f32,
    y: f32,
    text: &str,
    color: Rgb,
) {
    let encoded = encode_winansi(text);
    stream.push_str(&format!("{} {} {} rg\n", color.0, color.1, color.2));
    stream.push_str(&format!(
        "BT /{} {:.1} Tf {:.1} {:.1} Td <{}> Tj ET\n",
        font,
        size,
        x,
        y,
        format_pdf_hex_string(&encoded)
    ));
}

pub fn stream_object(stream: &str) -> Vec<u8> {
    format!(
        "<< /Length {} >>\nstream\n{}endstream",
        stream.as_bytes().len(),
        stream
    )
    .into_bytes()
}

pub fn build_pdf(streams: &[String]) -> Vec<u8> {
    let page_count = streams.len().max(1);
    let mut objects = Vec::new();

    objects.push("<< /Type /Catalog /Pages 2 0 R >>".as_bytes().to_vec());

    let page_ids = (0..page_count)
        .map(|index| 6 + (index * 2))
        .collect::<Vec<_>>();
    let kids = page_ids
        .iter()
        .map(|id| format!("{id} 0 R"))
        .collect::<Vec<_>>()
        .join(" ");
    objects.push(
        format!(
            "<< /Type /Pages /Kids [{}] /Count {} >>",
            kids, page_count
        )
        .into_bytes(),
    );
    objects.push(
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"
            .as_bytes()
            .to_vec(),
    );
    objects.push(
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"
            .as_bytes()
            .to_vec(),
    );

    for (index, stream) in streams.iter().enumerate() {
        let content_id = 5 + (index * 2);
        let page_id = content_id + 1;
        objects.push(stream_object(stream));
        objects.push(
            format!(
                "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {:.1} {:.1}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents {} 0 R >>",
                PAGE_WIDTH, PAGE_HEIGHT, content_id
            )
            .into_bytes(),
        );
        debug_assert_eq!(page_ids[index], page_id);
    }

    let mut output = Vec::new();
    output.extend_from_slice(b"%PDF-1.4\n");
    let mut offsets = Vec::with_capacity(objects.len() + 1);
    offsets.push(0);

    for (index, content) in objects.iter().enumerate() {
        let object_id = index + 1;
        offsets.push(output.len());
        output.extend_from_slice(format!("{object_id} 0 obj\n").as_bytes());
        output.extend_from_slice(content);
        output.extend_from_slice(b"\nendobj\n");
    }

    let xref_position = output.len();
    output.extend_from_slice(format!("xref\n0 {}\n", objects.len() + 1).as_bytes());
    output.extend_from_slice(b"0000000000 65535 f \n");
    for offset in offsets.iter().skip(1) {
        output.extend_from_slice(format!("{offset:010} 00000 n \n").as_bytes());
    }
    output.extend_from_slice(
        format!(
            "trailer\n<< /Size {} /Root 1 0 R >>\nstartxref\n{}\n%%EOF\n",
            objects.len() + 1,
            xref_position
        )
        .as_bytes(),
    );

    output
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn wraps_long_lines() {
        let lines = wrap_text(
            "one two three four five six seven eight nine ten eleven",
            10.0,
            0.0,
            200.0,
        );
        assert!(lines.len() > 1);
    }

    #[test]
    fn encodes_german_umlauts_for_winansi() {
        let bytes = encode_winansi("über Außendienst für Einführung");
        assert_eq!(bytes[0], 0xFC);
        assert!(bytes.contains(&0xDF));
        assert!(bytes.iter().filter(|byte| **byte == 0xFC).count() >= 3);
        assert!(!bytes.contains(&b'?'));
    }

    #[test]
    fn encodes_cv_punctuation() {
        let bytes = encode_winansi("2025 – Present · Skills");
        assert!(bytes.contains(&0x96));
        assert!(bytes.contains(&0xB7));
    }
}
