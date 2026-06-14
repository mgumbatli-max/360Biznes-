import React, { useEffect, useRef } from "react";
import { Animated, View } from "react-native";

type SkeletonProps = {
  className?: string;
};

export function Skeleton({ className = "" }: SkeletonProps) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.5,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={{ opacity }}
      className={`bg-line dark:bg-lineDark rounded-lg ${className}`}
    />
  );
}

export function ProductCardSkeleton() {
  return (
    <View className="bg-card dark:bg-cardDark border border-line dark:border-lineDark rounded-2xl p-3 mb-3">
      {/* Image placeholder */}
      <Skeleton className="w-full h-36 rounded-xl mb-3" />
      {/* Title line */}
      <Skeleton className="h-4 rounded w-3/4 mb-2" />
      {/* Subtitle line */}
      <Skeleton className="h-3 rounded w-1/2" />
    </View>
  );
}

type ListSkeletonProps = {
  count?: number;
};

export function ListSkeleton({ count = 4 }: ListSkeletonProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </>
  );
}
