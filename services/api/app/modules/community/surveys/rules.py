"""Survey rules (BRD FR-SRV-001 to 006, BR-045, BR-090, OD-21) as plain functions.

Answers are a map from question id to: an option key (single), a list of option keys (multiple),
a whole number 1 to 5 (scale) or text. "prefer_not_to_say" answers any sensitive question. Results
are counts only, and any count from 1 to 9 is hidden so that small groups cannot be singled out.
"""

from typing import Any, Literal

PERMISSION = "surveys.manage"  # PRM-22
PREFER_NOT_TO_SAY = "prefer_not_to_say"
SMALL_GROUP = 10
TEXT_MAX = 1000

QuestionKind = Literal["single", "multiple", "scale", "text"]


def check_questions(questions: list[dict[str, Any]]) -> list[str]:
    """A survey can open only with at least one question, and choice questions need two options."""
    problems = []
    if not questions:
        problems.append("questions_required")
    for index, question in enumerate(questions, start=1):
        keys = [option["key"] for option in question.get("options", [])]
        if question["kind"] in ("single", "multiple") and len(keys) < 2:
            problems.append(f"options_required:{index}")
        if len(keys) != len(set(keys)) or PREFER_NOT_TO_SAY in keys:
            problems.append(f"option_keys_invalid:{index}")
    return problems


def check_answers(questions: list[dict[str, Any]], answers: dict[str, Any]) -> list[str]:
    problems = []
    known = {str(q["id"]) for q in questions}
    if any(key not in known for key in answers):
        problems.append("unknown_question")
    for index, question in enumerate(questions, start=1):
        value = answers.get(str(question["id"]))
        if value is None or value == "" or value == []:
            if question["required"]:
                problems.append(f"answer_required:{index}")
            continue
        if value == PREFER_NOT_TO_SAY:
            if not question["sensitive"]:
                problems.append(f"answer_invalid:{index}")
            continue
        keys = {option["key"] for option in question["options"]}
        kind = question["kind"]
        valid = (
            (kind == "single" and isinstance(value, str) and value in keys)
            or (kind == "multiple" and isinstance(value, list) and all(isinstance(v, str) and v in keys for v in value)
                and len(value) == len(set(value)))
            or (kind == "scale" and isinstance(value, int) and not isinstance(value, bool) and 1 <= value <= 5)
            or (kind == "text" and isinstance(value, str) and len(value.strip()) <= TEXT_MAX)
        )
        if not valid:
            problems.append(f"answer_invalid:{index}")
    return problems


def hide_small(count: int) -> int | None:
    """None for 1 to 9: shown as "fewer than 10"."""
    return None if 0 < count < SMALL_GROUP else count
