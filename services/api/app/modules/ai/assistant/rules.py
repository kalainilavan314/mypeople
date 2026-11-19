"""Tamil AI assistant rules (BRD FR-AIA-001 to 010, BR-125 to 128, NFR-AI-05, OD-48) as plain functions.

The guardrails are in two layers. The model is told the rules (prompt.py); then every answer is
checked here before a member sees it: an answer must cite at least one of the passages it was given
or it becomes "cannot answer" (FR-AIA-003); a quote is shown as official text only if it is found
word for word in the passage it names (FR-AIA-004); anything else the model returns is dropped.
"""

import re
from collections.abc import Sequence
from dataclasses import dataclass, field
from typing import Any, Literal

from app.modules.ai.assistant.prompt import REFUSALS as PROMPT_REFUSALS
from app.modules.ai.assistant.prompt import TOPICS

Language = Literal["ta", "en"]
Outcome = Literal["answered", "no_source", "refused", "failed"]
Refusal = Literal["eligibility", "promise", "figures", "election_notice", "persuasion", "personal_data", "other"]
Unavailable = Literal["provider_not_configured", "model_not_approved", "model_not_registered"]
Rating = Literal["helpful", "not_helpful"]

# [ASSUMPTION] OD-48 recommends 30 days, with an opt-in for longer that the DPO has not set yet.
RETENTION_DAYS = 30
# [ASSUMPTION] A hand-over's copy of the conversation is kept 30 days after it is answered or closed;
# a resolved error report is kept a year (as a knowledge-base record, ENT-62's "superseded + 1 year").
HANDOVER_KEEP_DAYS = 30
ERROR_REPORT_KEEP_DAYS = 365

# [ASSUMPTION] Limits that keep the cost of a hosted model bounded and stop flooding.
QUESTIONS_PER_HOUR = 30
ERROR_REPORTS_PER_DAY = 10
OPEN_HANDOVERS_MAX = 3

QUESTION_MAX = 1000
PASSAGES = 6
HISTORY_MESSAGES = 4
QUOTES_MAX = 3
QUOTE_MIN = 10
QUOTE_MAX = 600
EXPLANATION_MAX = 4000

# Words that mark a question as being about eligibility, persuasion or an election (Tamil and English).
_FLAG_WORDS: dict[str, tuple[str, ...]] = {
    "eligibility": ("eligib", "qualify", "entitled", "தகுதி", "தகைமை", "உரித்து"),
    "persuasion": ("convince", "vote for", "should i vote", "should i support", "who to vote", "why support",
                   "யாருக்கு வாக்களி", "வாக்களிக்க வேண்டுமா", "ஏன் ஆதரிக்க", "நம்ப வை", "ஆதரிக்க வேண்டுமா"),
    "election": ("election", "polling", "ballot", "nomination", "தேர்தல்", "வாக்களிப்பு", "வாக்குச்சாவடி", "வேட்புமனு"),
}

REMINDERS = {
    "eligibility": "The member asks about eligibility: explain the process from the sources and never decide.",
    "persuasion": "The member asks to be persuaded or whom to support: stay neutral and only offer published material.",
    "election": "The member asks about an election: give dates, places or results only if a source quotes the Election Commission.",
}

FIXED_TEXT: dict[str, dict[str, str]] = {
    "no_source": {
        "ta": "மன்னிக்கவும், அங்கீகரிக்கப்பட்ட மூலங்களில் இதற்கான பதில் இல்லை. ஊகித்துச் சொல்ல மாட்டேன். "
              "கட்சியின் கொள்கைகள், இந்தச் செயலி அல்லது பொதுச் சேவைகள் பற்றி வேறு விதமாகக் கேட்டுப் பாருங்கள், "
              "அல்லது ஒருவருடன் பேசக் கேளுங்கள்.",
        "en": "Sorry, the approved sources do not answer this, and I will not guess. Try asking in another way about "
              "TMK's policies, this app or public services, or ask to talk to a person.",
    },
    "refused": {
        "ta": "இந்தக் கேள்விக்கு என்னால் பதில் அளிக்க முடியாது. ஒருவருடன் பேச விரும்பினால் கீழே கேளுங்கள்.",
        "en": "I can't answer this question. If you would like to talk to a person, ask below.",
    },
    "quoted": {
        "ta": "அதிகாரபூர்வ உரை கீழே உள்ளது.",
        "en": "The official text is below.",
    },
    "failed": {
        "ta": "இப்போது பதில் தயாரிக்க முடியவில்லை. சிறிது நேரத்தின் பின் மீண்டும் முயலுங்கள், அல்லது ஒருவருடன் பேசக் கேளுங்கள்.",
        "en": "I couldn't prepare an answer just now. Try again in a little while, or ask to talk to a person.",
    },
}


def fixed_text(outcome: str, language: str) -> str:
    return FIXED_TEXT[outcome]["en" if language == "en" else "ta"]


def topic_flags(text: str) -> list[str]:
    lowered = text.lower()
    return [flag for flag, words in _FLAG_WORDS.items() if any(word in lowered for word in words)]


def reminders(flags: Sequence[str]) -> list[str]:
    return [REMINDERS[flag] for flag in flags if flag in REMINDERS]


def excluded_kinds(*, in_silence: bool) -> list[str]:
    """[ASSUMPTION] NFR-ELC-03 extended to the assistant: while an election silence period covers the
    member's area, manifesto material is not used. The area only withholds; it never tailors (BR-127)."""
    return ["manifesto"] if in_silence else []


def normalise(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


@dataclass(frozen=True)
class CheckedAnswer:
    outcome: Outcome
    refusal: Refusal | None
    explanation: str
    sources: list[int]
    quotes: list[tuple[int, str]] = field(default_factory=list)
    topics: list[str] = field(default_factory=list)


def check_answer(data: dict[str, Any], passages: dict[int, str], language: str) -> CheckedAnswer:
    """The model's answer, kept only as far as the rules allow."""
    outcome = data.get("outcome")
    if outcome not in ("answered", "no_source", "refused"):
        return CheckedAnswer("failed", None, fixed_text("failed", language), [])
    refusal = data.get("refusal")
    refusal = refusal if refusal in PROMPT_REFUSALS and refusal != "none" else None
    explanation = str(data.get("explanation") or "").strip()[:EXPLANATION_MAX]
    raw_sources = data.get("sources") if isinstance(data.get("sources"), list) else []
    sources = [n for n in dict.fromkeys(raw_sources) if isinstance(n, int) and not isinstance(n, bool) and n in passages]
    topics = [t for t in dict.fromkeys(data.get("topics") or []) if t in TOPICS]
    if outcome == "answered" and not sources:
        # FR-AIA-003: an answer without a citation to an approved source is not shown.
        return CheckedAnswer("no_source", refusal, fixed_text("no_source", language), [], [], topics)
    if outcome == "no_source":
        return CheckedAnswer("no_source", refusal, explanation or fixed_text("no_source", language), [], [], topics)
    quotes: list[tuple[int, str]] = []
    for quote in data.get("quotes") or []:
        if not isinstance(quote, dict):
            continue
        number, words = quote.get("source"), normalise(str(quote.get("text") or ""))
        if number not in sources or not (QUOTE_MIN <= len(words) <= QUOTE_MAX):
            continue
        if words in normalise(passages[number]) and (number, words) not in quotes:
            quotes.append((number, words))
        if len(quotes) == QUOTES_MAX:
            break
    if not explanation:
        if outcome == "refused":
            explanation = fixed_text("refused", language)
        elif quotes:
            explanation = fixed_text("quoted", language)
        else:
            return CheckedAnswer("no_source", refusal, fixed_text("no_source", language), [], [], topics)
    return CheckedAnswer(outcome, refusal, explanation, sources, quotes, topics)  # type: ignore[arg-type]
