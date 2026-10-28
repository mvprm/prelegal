"""Sample Mutual NDA data shared by the NDA tests, in the JSON shape the browser sends."""

EMPTY_PARTY = {"name": "", "title": "", "company": "", "noticeAddress": ""}

# The frontend's defaultFields, with the effective date it fills in.
DEFAULT_FIELDS = {
    "purpose": "Evaluating whether to enter into a business relationship with the other party.",
    "effectiveDate": "2026-10-28",
    "mndaTerm": "expires",
    "mndaTermYears": 1,
    "confidentialityTerm": "years",
    "confidentialityYears": 1,
    "governingLaw": "",
    "jurisdiction": "",
    "modifications": "",
    "party1": EMPTY_PARTY,
    "party2": EMPTY_PARTY,
}
