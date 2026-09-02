from __future__ import annotations

from dataclasses import dataclass
import secrets
from typing import Final, Iterable

from app.service.active_liveness_service import BLINK
from app.service.head_turn_liveness_service import (
    TURN_LEFT,
    TURN_RIGHT,
)


CHALLENGE_SELECTED: Final[str] = "CHALLENGE_SELECTED"
ASSISTED_VERIFICATION_REQUIRED: Final[str] = (
    "ASSISTED_VERIFICATION_REQUIRED"
)

SUPPORTED_CHALLENGES: Final[tuple[str, ...]] = (
    BLINK,
    TURN_LEFT,
    TURN_RIGHT,
)

CHALLENGE_PROMPTS: Final[dict[str, str]] = {
    BLINK: "BLINK ONCE",
    TURN_LEFT: "TURN YOUR HEAD LEFT",
    TURN_RIGHT: "TURN YOUR HEAD RIGHT",
}


@dataclass(frozen=True)
class ChallengeSelection:
    status: str
    challenge_type: str | None
    prompt: str
    allowed_challenges: tuple[str, ...]


def normalize_challenge_type(
    value: str,
) -> str:
    normalized = (
        value
        .strip()
        .upper()
        .replace("-", "_")
        .replace(" ", "_")
    )

    aliases = {
        "BLINK_ONCE": BLINK,
        "LEFT": TURN_LEFT,
        "TURNLEFT": TURN_LEFT,
        "RIGHT": TURN_RIGHT,
        "TURNRIGHT": TURN_RIGHT,
    }

    normalized = aliases.get(
        normalized,
        normalized,
    )

    if normalized not in SUPPORTED_CHALLENGES:
        raise ValueError(
            "Unsupported liveness challenge: "
            f"{value!r}. Supported values: "
            f"{', '.join(SUPPORTED_CHALLENGES)}."
        )

    return normalized


def normalize_allowed_challenges(
    allowed_challenges: Iterable[str],
) -> tuple[str, ...]:
    normalized: list[str] = []

    for challenge in allowed_challenges:
        challenge_type = normalize_challenge_type(
            challenge
        )

        if challenge_type not in normalized:
            normalized.append(
                challenge_type
            )

    # Keep one canonical order so database/API values remain predictable.
    return tuple(
        challenge
        for challenge in SUPPORTED_CHALLENGES
        if challenge in normalized
    )


def select_random_challenge(
    allowed_challenges: Iterable[str],
) -> ChallengeSelection:
    """
    Select exactly ONE challenge from the user's allowed challenge set.

    Accessibility rule:
    The caller passes only the movements that are appropriate for the
    student. The policy does NOT need or store a medical diagnosis.

    Security rule:
    Challenge selection uses `secrets.choice`, not a predictable PRNG.

    Production note:
    The authoritative challenge must eventually be created and stored by
    Spring Boot together with challenge ID, purpose, expiry, and status.
    This Python policy is currently used to prototype and test the behavior
    before the Spring API is wired.
    """
    allowed = normalize_allowed_challenges(
        allowed_challenges
    )

    if not allowed:
        return ChallengeSelection(
            status=ASSISTED_VERIFICATION_REQUIRED,
            challenge_type=None,
            prompt="REQUEST ADVISER ASSISTANCE",
            allowed_challenges=(),
        )

    selected = secrets.choice(
        allowed
    )

    return ChallengeSelection(
        status=CHALLENGE_SELECTED,
        challenge_type=selected,
        prompt=CHALLENGE_PROMPTS[
            selected
        ],
        allowed_challenges=allowed,
    )
