package com.kagein.springbff.geo;

public final class Geometry {

    private static final double EARTH_RADIUS_M = 6_371_000.0;

    private Geometry() {
    }

    public static double distanceMeters(double latA, double lonA, double latB, double lonB) {
        double dLat = Math.toRadians(latB - latA);
        double dLon = Math.toRadians(lonB - lonA);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(latA)) * Math.cos(Math.toRadians(latB))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    // Even-odd ray casting. vertices are [lat, lon] pairs; treats lon as x, lat as y.
    public static boolean pointInPolygon(double lat, double lon, double[][] vertices) {
        boolean inside = false;
        int n = vertices.length;
        for (int i = 0, j = n - 1; i < n; j = i++) {
            double yi = vertices[i][0], xi = vertices[i][1];
            double yj = vertices[j][0], xj = vertices[j][1];
            boolean intersects = ((yi > lat) != (yj > lat))
                    && (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi);
            if (intersects) {
                inside = !inside;
            }
        }
        return inside;
    }
}
