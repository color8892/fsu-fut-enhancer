#[derive(Debug, Clone, thiserror::Error)]
pub enum EaClientError {
    #[error("HTTP request failed: {0}")]
    Http(String),
    #[error("missing session token")]
    MissingSession,
    #[error("JSON parse failed: {0}")]
    Parse(String),
    #[error("endpoint not implemented: {0}")]
    NotImplemented(&'static str),
}