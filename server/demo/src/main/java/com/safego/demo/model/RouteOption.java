package com.safego.demo.model;

import java.util.List;

/**
 * An alternative road route between the same two places, as OSRM returned it. The browser scores it
 * with the same live data as the main route. Duration is OSRM's free-flow driving time: no traffic,
 * flooding or closures, so it is only used to compare routes, never shown as an arrival time.
 */
public record RouteOption(
    String routeId,
    double[][] routeCoordinates,
    List<String> roadNames,
    Double durationSeconds,
    Double distanceMeters
) {}
