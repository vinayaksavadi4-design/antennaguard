def make_recommendation(values: dict, probability: float) -> tuple[str, str]:
    p = probability
    if p >= 0.70:
        severity = "HIGH"
        recommendation = (
            "Review the long or metal-heavy net first. Reduce exposed metal area or wire length where possible, "
            "increase effective gate area, and consider a foundry-approved antenna protection strategy."
        )
    elif p >= 0.40:
        severity = "MEDIUM"
        recommendation = (
            "Flag this route for physical-design review. Check layer transitions, metal width, spacing and exposed "
            "interconnect length against the technology's official antenna rules."
        )
    else:
        severity = "LOW"
        recommendation = (
            "The model estimates a lower antenna risk for this feature set. Continue normal DRC/antenna verification "
            "before sign-off."
        )
    return severity, recommendation
