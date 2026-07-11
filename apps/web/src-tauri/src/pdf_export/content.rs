use serde_json::Value;

#[derive(Debug, Clone)]
pub struct ExperienceEntry {
    pub title: String,
    pub company: String,
    pub location: String,
    pub technologies: String,
    pub date_range: String,
    pub bullets: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct ProjectEntry {
    pub name: String,
    pub role: String,
    pub url: String,
    pub technologies: String,
    pub description: String,
    pub bullets: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct EducationEntry {
    pub degree: String,
    pub institution: String,
    pub location: String,
    pub date_range: String,
    pub details: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct CvContent {
    pub name: String,
    pub headline: String,
    pub contact_line: String,
    pub summary: String,
    pub skills: Vec<String>,
    pub experience: Vec<ExperienceEntry>,
    pub projects: Vec<ProjectEntry>,
    pub education: Vec<EducationEntry>,
    pub languages: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct ExportLabels {
    pub summary: String,
    pub skills: String,
    pub experience: String,
    pub projects: String,
    pub education: String,
    pub languages: String,
    pub present: String,
    pub name_fallback: String,
}

impl Default for ExportLabels {
    fn default() -> Self {
        Self {
            summary: "Summary".to_string(),
            skills: "Skills".to_string(),
            experience: "Experience".to_string(),
            projects: "Projects".to_string(),
            education: "Education".to_string(),
            languages: "Languages".to_string(),
            present: "Present".to_string(),
            name_fallback: "CV".to_string(),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CvTemplate {
    Classic,
    Modern,
    Sidebar,
    Minimal,
    Executive,
}

impl CvTemplate {
    pub fn parse(value: Option<&str>) -> Self {
        match value.unwrap_or("classic") {
            "modern" => Self::Modern,
            "sidebar" => Self::Sidebar,
            "minimal" => Self::Minimal,
            "executive" => Self::Executive,
            _ => Self::Classic,
        }
    }
}

pub fn parse_labels(value: Option<&Value>) -> ExportLabels {
    let Some(labels) = value else {
        return ExportLabels::default();
    };

    ExportLabels {
        summary: read_string(labels, "summary", "Summary"),
        skills: read_string(labels, "skills", "Skills"),
        experience: read_string(labels, "experience", "Experience"),
        projects: read_string(labels, "projects", "Projects"),
        education: read_string(labels, "education", "Education"),
        languages: read_string(labels, "languages", "Languages"),
        present: read_string(labels, "present", "Present"),
        name_fallback: read_string(labels, "nameFallback", "CV"),
    }
}

pub fn parse_content(
    profile: &Value,
    generated_cv: &Value,
    labels: &ExportLabels,
) -> CvContent {
    let cv = generated_cv.get("cv").unwrap_or(&Value::Null);
    let contact_links = array_strings_at(profile, &["contact", "links"]);
    let contact_line = join_non_empty(
        &[
            string_at(profile, &["contact", "email"]).to_string(),
            string_at(profile, &["contact", "phone"]).to_string(),
            string_at(profile, &["contact", "location"]).to_string(),
            contact_links.join(" · "),
        ],
        " · ",
    );

    let name = string_at(profile, &["contact", "name"]);
    let source_experience = object_array_at(profile, &["experience"]);
    let tailored_experience = object_array_at(cv, &["experience"]);
    let experience = tailored_experience
        .iter()
        .filter_map(|tailored_item| {
            let experience_id = string_at(tailored_item, &["experienceId"]);
            let source = find_by_id(&source_experience, experience_id)?;
            let current = source
                .get("current")
                .and_then(Value::as_bool)
                .unwrap_or(false);
            Some(ExperienceEntry {
                title: string_at(source, &["title"]).to_string(),
                company: string_at(source, &["company"]).to_string(),
                location: string_at(source, &["location"]).to_string(),
                technologies: array_strings_at(source, &["technologies"]).join(", "),
                date_range: join_date_range(
                    string_at(source, &["startDate"]),
                    string_at(source, &["endDate"]),
                    current,
                    &labels.present,
                ),
                bullets: array_strings_at(tailored_item, &["bullets"]),
            })
        })
        .collect();

    let source_projects = object_array_at(profile, &["projects"]);
    let tailored_projects = object_array_at(cv, &["projects"]);
    let projects = tailored_projects
        .iter()
        .filter_map(|tailored_item| {
            let project_id = string_at(tailored_item, &["projectId"]);
            let source = find_by_id(&source_projects, project_id)?;
            Some(ProjectEntry {
                name: string_at(source, &["name"]).to_string(),
                role: string_at(source, &["role"]).to_string(),
                url: string_at(source, &["url"]).to_string(),
                technologies: array_strings_at(source, &["technologies"]).join(", "),
                description: string_at(source, &["description"]).to_string(),
                bullets: array_strings_at(tailored_item, &["bullets"]),
            })
        })
        .collect();

    let education_ids = array_strings_at(cv, &["educationIds"]);
    let source_education = object_array_at(profile, &["education"]);
    let education = source_education
        .iter()
        .copied()
        .filter(|item| {
            education_ids
                .iter()
                .any(|id| id == string_at(item, &["id"]))
        })
        .map(|item| {
            let degree = string_at(item, &["degree"]);
            EducationEntry {
                degree: if degree.is_empty() {
                    string_at(item, &["institution"]).to_string()
                } else {
                    degree.to_string()
                },
                institution: string_at(item, &["institution"]).to_string(),
                location: string_at(item, &["location"]).to_string(),
                date_range: join_date_range(
                    string_at(item, &["startDate"]),
                    string_at(item, &["endDate"]),
                    false,
                    &labels.present,
                ),
                details: array_strings_at(item, &["details"]),
            }
        })
        .collect();

    CvContent {
        name: if name.is_empty() {
            labels.name_fallback.clone()
        } else {
            name.to_string()
        },
        headline: string_at(profile, &["headline"]).to_string(),
        contact_line,
        summary: string_at(cv, &["summary"]).to_string(),
        skills: array_strings_at(cv, &["skills"]),
        experience,
        projects,
        education,
        languages: array_strings_at(profile, &["languages"]),
    }
}

fn read_string(value: &Value, key: &str, fallback: &str) -> String {
    value
        .get(key)
        .and_then(Value::as_str)
        .filter(|text| !text.trim().is_empty())
        .unwrap_or(fallback)
        .to_string()
}

fn string_at<'a>(value: &'a Value, path: &[&str]) -> &'a str {
    let mut current = value;

    for key in path {
        let Some(next) = current.get(*key) else {
            return "";
        };
        current = next;
    }

    current.as_str().unwrap_or("")
}

fn array_strings_at(value: &Value, path: &[&str]) -> Vec<String> {
    let mut current = value;

    for key in path {
        let Some(next) = current.get(*key) else {
            return Vec::new();
        };
        current = next;
    }

    current
        .as_array()
        .map(|items| {
            items
                .iter()
                .filter_map(|item| item.as_str().map(ToString::to_string))
                .filter(|item| !item.trim().is_empty())
                .collect()
        })
        .unwrap_or_default()
}

fn object_array_at<'a>(value: &'a Value, path: &[&str]) -> Vec<&'a Value> {
    let mut current = value;

    for key in path {
        let Some(next) = current.get(*key) else {
            return Vec::new();
        };
        current = next;
    }

    current
        .as_array()
        .map(|items| items.iter().collect())
        .unwrap_or_default()
}

fn find_by_id<'a>(items: &'a [&Value], id: &str) -> Option<&'a Value> {
    items
        .iter()
        .copied()
        .find(|item| string_at(item, &["id"]) == id)
}

fn join_non_empty(values: &[String], separator: &str) -> String {
    values
        .iter()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
        .collect::<Vec<_>>()
        .join(separator)
}

fn join_date_range(
    start_date: &str,
    end_date: &str,
    current: bool,
    present_label: &str,
) -> String {
    let end = if current { present_label } else { end_date };
    [start_date, end]
        .iter()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
        .collect::<Vec<_>>()
        .join(" – ")
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn parses_cv_content_with_labels() {
        let profile = json!({
            "contact": {
                "name": "Ada Lovelace",
                "email": "ada@example.com",
                "phone": "",
                "location": "London",
                "links": []
            },
            "headline": "Engineer",
            "experience": [{
                "id": "exp-1",
                "title": "Developer",
                "company": "Analytical",
                "location": "London",
                "startDate": "1840",
                "endDate": "1850",
                "current": false,
                "technologies": ["Math"]
            }],
            "projects": [],
            "education": [],
            "languages": ["English"]
        });
        let generated_cv = json!({
            "cv": {
                "summary": "Summary text",
                "skills": ["Math"],
                "experience": [{ "experienceId": "exp-1", "bullets": ["Built things"] }],
                "projects": [],
                "educationIds": []
            }
        });
        let labels = ExportLabels {
            present: "Heute".to_string(),
            ..ExportLabels::default()
        };

        let content = parse_content(&profile, &generated_cv, &labels);
        assert_eq!(content.name, "Ada Lovelace");
        assert_eq!(content.experience[0].date_range, "1840 – 1850");
    }
}
