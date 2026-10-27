package com.safego.demo.data;

import com.safego.demo.model.RiskFactor;
import com.safego.demo.model.SafeGoLocation;

import java.util.List;

/**
 * The places SafeGo rates: where they are and what people call them. No conditions are stored here;
 * every reading comes from live sources at run time. Keep in step with lib/safego/locations.ts.
 */
public final class LocationAnchors {

    private static final String WAITING = "SafeGo is waiting for current sources.";

    private LocationAnchors() {}

    private static final List<SafeGoLocation> LOCATIONS = List.of(
        anchor("espana", "España Blvd., Sampaloc", "Manila", List.of("espana", "españa", "sampaloc", "morayta"), 14.612, 120.9902),
        anchor("mapua-makati", "Mapúa University, Makati", "Makati", List.of("mapua", "mapúa", "makati", "mapua makati", "campus"), 14.5665, 121.02),
        anchor("quiapo", "Quiapo underpass", "Manila", List.of("quiapo", "underpass", "quezon bridge"), 14.5995, 120.9842),
        anchor("lerma", "Lerma St., Sampaloc", "Manila", List.of("lerma", "sampaloc"), 14.6049, 120.9888),
        anchor("ortigas-pasig", "Ortigas Center, Pasig", "Pasig", List.of("ortigas", "pasig", "ortigas center", "kapitolyo"), 14.5869, 121.0614),
        anchor("marikina-riverbanks", "Marikina Riverbanks, Marikina", "Marikina", List.of("marikina", "riverbanks", "marikina river", "tumana", "provident"), 14.6346, 121.0963),
        anchor("malabon-dampalit", "C-4 Road / Dampalit, Malabon", "Malabon", List.of("malabon", "dampalit", "c4", "tullahan", "concepcion", "hulong duhat"), 14.6645, 120.9575),
        anchor("navotas-nbbs", "North Bay Blvd. South (NBBS), Navotas", "Navotas", List.of("navotas", "nbbs", "r10", "fish port", "san rafael"), 14.6441, 120.9535),
        anchor("valenzuela-malinta", "MacArthur Highway, Malinta, Valenzuela", "Valenzuela", List.of("valenzuela", "malinta", "macarthur", "dalandanan", "karuhatan"), 14.6933, 120.9634),
        anchor("qc-araneta", "G. Araneta Ave. / Talayan, Quezon City", "Quezon City", List.of("araneta", "talayan", "tatalon", "quezon city", "qc", "maria clara", "e rodriguez"), 14.6385, 121.003),
        anchor("mandaluyong-maysilo", "Maysilo Circle, Mandaluyong", "Mandaluyong", List.of("mandaluyong", "maysilo", "boni", "plainview", "city hall"), 14.5772, 121.0347),
        anchor("san-juan-river", "F. Manalo / San Juan River, San Juan", "San Juan", List.of("san juan", "manalo", "san juan river", "batis", "progreso"), 14.6042, 121.0267),
        anchor("paranaque-sucat", "Dr. A. Santos Ave. (Sucat), Parañaque", "Parañaque", List.of("paranaque", "parañaque", "sucat", "kabihasnan", "santos"), 14.4988, 120.9882),
        anchor("pasay-rotonda", "Taft Ave. / EDSA Rotonda, Pasay", "Pasay", List.of("pasay", "rotonda", "taft", "edsa", "baclaran", "malibay"), 14.5378, 120.9995),
        anchor("taguig-c6", "C-6 Road / Hagonoy, Taguig", "Taguig", List.of("taguig", "c6", "hagonoy", "lakeshore", "lower bicutan"), 14.5098, 121.0742),
        anchor("laspinas-zapote", "Alabang–Zapote Road, Zapote, Las Piñas", "Las Piñas", List.of("las pinas", "las piñas", "zapote", "alabang zapote", "talaba"), 14.4635, 120.9765),
        anchor("muntinlupa-bayanan", "National Road, Bayanan, Muntinlupa", "Muntinlupa", List.of("muntinlupa", "bayanan", "alabang", "putatan", "poblacion"), 14.4081, 121.0415),
        anchor("caloocan-monumento", "Monumento / Samson Road, Caloocan", "Caloocan", List.of("caloocan", "kalookan", "monumento", "samson", "mcu", "edsa"), 14.6575, 120.9836)
    );

    public static List<SafeGoLocation> locations() {
        return LOCATIONS;
    }

    private static SafeGoLocation anchor(String id, String name, String city, List<String> aliases, double latitude, double longitude) {
        List<RiskFactor> factors = List.of(
            unavailable("Weather", "weather"),
            unavailable("Flood / roads", "flood"),
            unavailable("Official advisories", "alert"),
            unavailable("School status", "school"),
            unavailable("Community reports", "reports")
        );
        return new SafeGoLocation(
            id, name, city, aliases, new double[] {latitude, longitude},
            "Awaiting live update", WAITING, "Not rated",
            List.of(), factors, List.of(), List.of(), List.of(), List.of(), List.of(), List.of(),
            RiskModel.analyzeRisk(factors, WAITING, "Not rated")
        );
    }

    private static RiskFactor unavailable(String name, String icon) {
        return new RiskFactor(name, 0, "low", "Unavailable", "No current source is connected for this factor.", icon, "icon-neutral");
    }
}
