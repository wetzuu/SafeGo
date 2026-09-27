package com.safego.demo.service;

import com.safego.demo.api.TripAnalyzeController.RouteResult;
import com.safego.demo.util.GeoUtils;

import java.util.List;

public final class DemoRoutes {

    public static final double[] ESPANA_COORD = {14.612, 120.9902};
    public static final double[] LERMA_COORD = {14.6049, 120.9888};

    public static final double[][] ESPANA_TO_LERMA = {
        {14.612167, 120.990381}, {14.611941, 120.990603}, {14.611887, 120.990655},
        {14.611788, 120.990755}, {14.611396, 120.991132}, {14.611344, 120.991183},
        {14.610699, 120.991798}, {14.610463, 120.992028}, {14.61003,  120.992445},
        {14.609809, 120.992658}, {14.609731, 120.992738}, {14.609648, 120.992821},
        {14.609593, 120.992872}, {14.609105, 120.993325}, {14.608999, 120.993307},
        {14.608912, 120.993303}, {14.608099, 120.993278}, {14.608011, 120.993275},
        {14.607935, 120.993192}, {14.607909, 120.993165}, {14.607701, 120.992934},
        {14.607513, 120.992723}, {14.607254, 120.992434}, {14.607011, 120.992172},
        {14.606766, 120.991909}, {14.606734, 120.991872}, {14.606524, 120.991637},
        {14.606314, 120.991404}, {14.606038, 120.991097}, {14.605542, 120.990557},
        {14.605282, 120.990275}, {14.605052, 120.990016}, {14.604856, 120.989801},
        {14.60472,  120.989649}, {14.604575, 120.989481}, {14.605074, 120.988988}
    };

    public static final List<String> DEMO_ROAD_NAMES = List.of(
        "A. H. Lacson Avenue",
        "M. Earnshaw Street",
        "S. H. Loyola Street",
        "Padre Campa Street"
    );

    private DemoRoutes() {}

    public static RouteResult savedDemoRoute(double[] origin, double[] dest) {
        if (GeoUtils.samePoint(origin, ESPANA_COORD) && GeoUtils.samePoint(dest, LERMA_COORD)) {
            return new RouteResult(ESPANA_TO_LERMA.clone(), DEMO_ROAD_NAMES, "saved-demo");
        }
        if (GeoUtils.samePoint(origin, LERMA_COORD) && GeoUtils.samePoint(dest, ESPANA_COORD)) {
            double[][] reversed = new double[ESPANA_TO_LERMA.length][];
            for (int i = 0; i < ESPANA_TO_LERMA.length; i++) {
                reversed[i] = ESPANA_TO_LERMA[ESPANA_TO_LERMA.length - 1 - i];
            }
            return new RouteResult(reversed, DEMO_ROAD_NAMES, "saved-demo");
        }
        return null;
    }
}
