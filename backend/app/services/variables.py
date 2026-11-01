"""The six monitored variables and their display metadata."""

VARIABLES: dict[str, dict] = {
    "influent_turbidity": {"label": "Influent Turbidity", "unit": "NTU", "stage": "influent"},
    "influent_ph": {"label": "Influent pH", "unit": "", "stage": "influent"},
    # Unit as recorded by the plant: mg per thousand tonnes of water (mg/千吨水).
    "naocl_dosage": {"label": "NaOCl Dosage", "unit": "mg/kt", "stage": "treatment"},
    "outlet_turbidity": {"label": "Outlet Turbidity", "unit": "NTU", "stage": "outlet"},
    "outlet_ph": {"label": "Outlet pH", "unit": "", "stage": "outlet"},
    "outlet_free_chlorine": {"label": "Outlet Free Chlorine", "unit": "mg/L", "stage": "outlet"},
}

VARIABLE_KEYS = list(VARIABLES.keys())

# Prediction targets (next-day outlet indicators), per proposal objective 2.
TARGETS = ["outlet_turbidity", "outlet_ph", "outlet_free_chlorine"]

# Reference ranges shown on the dashboard. These are general guideline values for context only;
# they are not used to classify water as safe/unsafe.
REFERENCE_RANGES: dict[str, dict] = {
    "outlet_turbidity": {"max": 1.0, "note": "WHO: ideally below 1 NTU for effective disinfection"},
    "outlet_ph": {"min": 6.5, "max": 8.5, "note": "Common operational range 6.5–8.5"},
    "outlet_free_chlorine": {"min": 0.2, "max": 5.0, "note": "WHO guideline max 5 mg/L; ≥0.2 mg/L residual commonly targeted"},
}

# Header aliases used to map uploaded Excel columns onto canonical keys.
# Matching is done on a normalized header (lowercase, alphanumerics only).
COLUMN_ALIASES: dict[str, list[str]] = {
    "date": ["date", "day", "sampledate", "datetime", "time", "日期"],
    "influent_turbidity": ["influentturbidity", "inletturbidity", "rawturbidity", "turbidityin", "进水浊度", "入水浑浊度", "入水浊度", "进水浑浊度"],
    "influent_ph": ["influentph", "inletph", "rawph", "phin", "进水ph", "入水ph"],
    "naocl_dosage": ["naocldosage", "sodiumhypochloritedosage", "hypochloritedosage", "naocl", "chlorinedosage", "次氯酸钠药剂投加", "次氯酸钠投加量", "次氯酸钠", "投加量"],
    "outlet_turbidity": ["outletturbidity", "effluentturbidity", "treatedturbidity", "turbidityout", "出水浊度", "出水浑浊度"],
    "outlet_ph": ["outletph", "effluentph", "treatedph", "phout", "出水ph"],
    "outlet_free_chlorine": ["outletfreechlorine", "freechlorine", "residualchlorine", "outletchlorine", "freeresidualchlorine", "出水游离氯", "游离氯", "出水余氯", "余氯"],
}
