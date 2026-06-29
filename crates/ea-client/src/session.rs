use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum GamePlatform {
    Ps,
    Pc,
    Xbox,
}

impl GamePlatform {
    pub fn as_utas_param(self) -> &'static str {
        match self {
            Self::Ps => "ps5",
            Self::Pc => "pc",
            Self::Xbox => "xbox",
        }
    }
}

/// Minimal authenticated session metadata for UTAS calls.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct EaSession {
    pub access_token: String,
    pub game_platform: GamePlatform,
    pub persona_id: Option<String>,
    pub nucleus_id: Option<String>,
}

impl EaSession {
    pub fn new(access_token: impl Into<String>, game_platform: GamePlatform) -> Self {
        Self {
            access_token: access_token.into(),
            game_platform,
            persona_id: None,
            nucleus_id: None,
        }
    }

    pub fn with_persona(mut self, persona_id: impl Into<String>) -> Self {
        self.persona_id = Some(persona_id.into());
        self
    }

    pub fn with_nucleus(mut self, nucleus_id: impl Into<String>) -> Self {
        self.nucleus_id = Some(nucleus_id.into());
        self
    }
}