package com.kagein.springbff.geo;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class GeometryTest {

    @Test
    void distanceBetweenSamePointIsZero() {
        assertThat(Geometry.distanceMeters(-23.56, -46.65, -23.56, -46.65)).isZero();
    }

    @Test
    void distanceIsRoughlyCorrectForAShortHop() {
        // ~111 meters north (0.001 degrees latitude).
        double d = Geometry.distanceMeters(-23.560, -46.650, -23.561, -46.650);
        assertThat(d).isBetween(100.0, 125.0);
    }

    @Test
    void pointInsideSquarePolygonIsInside() {
        double[][] square = {{0, 0}, {0, 2}, {2, 2}, {2, 0}};
        assertThat(Geometry.pointInPolygon(1, 1, square)).isTrue();
    }

    @Test
    void pointOutsideSquarePolygonIsOutside() {
        double[][] square = {{0, 0}, {0, 2}, {2, 2}, {2, 0}};
        assertThat(Geometry.pointInPolygon(3, 3, square)).isFalse();
    }

    @Test
    void pointInsideConcavePolygonIsInside() {
        // An "L" shape; (0.5, 0.5) sits in the arm, (1.5, 1.5) is in the notch.
        double[][] lShape = {{0, 0}, {0, 2}, {1, 2}, {1, 1}, {2, 1}, {2, 0}};
        assertThat(Geometry.pointInPolygon(0.5, 0.5, lShape)).isTrue();
        assertThat(Geometry.pointInPolygon(1.5, 1.5, lShape)).isFalse();
    }
}
