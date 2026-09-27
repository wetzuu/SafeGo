package com.safego.demo.util;

import java.text.Normalizer;

public final class GeoUtils {

    private GeoUtils() {}

    public static double distanceKm(double[] a, double[] b) {
        double r = 6371.0;
        double dLat = Math.toRadians(b[0] - a[0]);
        double dLon = Math.toRadians(b[1] - a[1]);
        double sinLat = Math.sin(dLat / 2);
        double sinLon = Math.sin(dLon / 2);
        double v = sinLat * sinLat
            + Math.cos(Math.toRadians(a[0])) * Math.cos(Math.toRadians(b[0])) * sinLon * sinLon;
        return r * 2 * Math.atan2(Math.sqrt(v), Math.sqrt(1 - v));
    }

    public static boolean samePoint(double[] a, double[] b) {
        return Math.abs(a[0] - b[0]) < 0.000001 && Math.abs(a[1] - b[1]) < 0.000001;
    }

    public static String clean(Object v) {
        return (v instanceof String s) ? s.replaceAll("\\s+", " ").trim() : "";
    }

    public static String normalize(String v) {
        if (v == null) return "";
        return Normalizer.normalize(v, Normalizer.Form.NFD)
            .replaceAll("\\p{M}", "")
            .toLowerCase()
            .replaceAll("[^a-z0-9]+", " ")
            .trim();
    }

    public static boolean isValidCoordinate(double[] pt) {
        if (pt == null || pt.length < 2) return false;
        double lat = pt[0];
        double lon = pt[1];
        return !Double.isNaN(lat) && !Double.isNaN(lon)
            && !Double.isInfinite(lat) && !Double.isInfinite(lon)
            && Math.abs(lat) <= 90.0 && Math.abs(lon) <= 180.0;
    }
}
