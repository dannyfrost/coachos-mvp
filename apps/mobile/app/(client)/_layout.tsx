import React, { useRef, useEffect, useState, ComponentProps } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, fontFamily, cardShadow } from '../../lib/design-system';

type CustomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

function TabItem({
  route,
  isFocused,
  descriptor,
  navigation,
}: {
  route: CustomTabBarProps['state']['routes'][number];
  isFocused: boolean;
  descriptor: CustomTabBarProps['descriptors'][string];
  navigation: CustomTabBarProps['navigation'];
}) {
  const scaleAnim = useRef(new Animated.Value(isFocused ? 1.18 : 1.0)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: isFocused ? 1.18 : 1.0,
      friction: 6,
      tension: 140,
      useNativeDriver: true,
    }).start();
  }, [isFocused, scaleAnim]);

  const { options } = descriptor;
  const label =
    options.tabBarLabel !== undefined
      ? options.tabBarLabel
      : options.title !== undefined
      ? options.title
      : route.name;

  const onPress = () => {
    const event = navigation.emit({
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true,
    });

    if (!isFocused && !event.defaultPrevented) {
      navigation.navigate(route.name, route.params);
    }
  };

  const onLongPress = () => {
    navigation.emit({
      type: 'tabLongPress',
      target: route.key,
    });
  };

  const iconColor = isFocused ? T.primary : T.muted;
  const iconElement = options.tabBarIcon
    ? options.tabBarIcon({
        focused: isFocused,
        color: iconColor,
        size: 22,
      })
    : null;

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      accessibilityLabel={
        options.tabBarAccessibilityLabel ??
        (typeof label === 'string' ? label : undefined)
      }
      testID={(options as { tabBarTestID?: string }).tabBarTestID}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.8}
      style={styles.tabButton}
    >
      <Animated.View
        style={[styles.iconContainer, { transform: [{ scale: scaleAnim }] }]}
      >
        {iconElement}
      </Animated.View>
      {typeof label === 'string' ? (
        <Text
          numberOfLines={1}
          style={[
            styles.tabLabel,
            {
              color: isFocused ? T.primary : T.muted,
              fontFamily: isFocused
                ? fontFamily.bodyBold
                : fontFamily.bodySemiBold,
              fontWeight: isFocused ? '700' : '600',
            },
          ]}
        >
          {label}
        </Text>
      ) : typeof label === 'function' ? (
        label({
          focused: isFocused,
          color: iconColor,
          position: 'below-icon',
          children: route.name,
        })
      ) : null}
    </TouchableOpacity>
  );
}

function CustomTabBar({
  state,
  descriptors,
  navigation,
  insets: tabBarInsets,
}: CustomTabBarProps) {
  const safeAreaInsets = useSafeAreaInsets();
  const insets = tabBarInsets ?? safeAreaInsets;
  const dimensions = useWindowDimensions();
  const [barWidth, setBarWidth] = useState(dimensions.width);

  const focusedRoute = state.routes[state.index];
  const activeIndex = state.index;
  const numTabs = state.routes.length || 1;
  const tabWidth = barWidth / numTabs;
  const pillWidth = Math.max(28, tabWidth - 24);
  const pillMarginLeft = (tabWidth - pillWidth) / 2;

  const indicatorAnim = useRef(
    new Animated.Value(
      activeIndex >= 0 ? activeIndex * tabWidth : 0
    )
  ).current;
  const prevIndexRef = useRef(activeIndex);

  useEffect(() => {
    if (activeIndex >= 0 && tabWidth > 0) {
      const targetValue = activeIndex * tabWidth;
      if (prevIndexRef.current === -1) {
        indicatorAnim.setValue(targetValue);
      } else {
        Animated.spring(indicatorAnim, {
          toValue: targetValue,
          friction: 8,
          tension: 110,
          useNativeDriver: true,
        }).start();
      }
      prevIndexRef.current = activeIndex;
    }
  }, [activeIndex, tabWidth, indicatorAnim]);

  return (
    <View
      onLayout={(e) => {
        const measuredWidth = e.nativeEvent.layout.width;
        if (measuredWidth > 0 && measuredWidth !== barWidth) {
          setBarWidth(measuredWidth);
        }
      }}
      style={[
        styles.tabBarContainer,
        {
          paddingBottom: Math.max(insets.bottom, 8),
        },
      ]}
    >
      {/* Sliding active indicator bar */}
      {tabWidth > 0 && activeIndex >= 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.slidingIndicator,
            {
              width: pillWidth,
              left: pillMarginLeft,
              transform: [{ translateX: indicatorAnim }],
            },
          ]}
        >
          <LinearGradient
            colors={[T.primary, T.primaryMid]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.indicatorGradient}
          />
        </Animated.View>
      )}

      {/* Tabs */}
      <View style={styles.tabsRow}>
        {state.routes.map((route) => {
          const isFocused = focusedRoute?.key === route.key;
          return (
            <TabItem
              key={route.key}
              route={route}
              isFocused={isFocused}
              descriptor={descriptors[route.key]}
              navigation={navigation}
            />
          );
        })}
      </View>
    </View>
  );
}

export default function ClientLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: T.primary,
        tabBarInactiveTintColor: T.muted,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Menu',
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons
              name={focused ? 'home' : 'home-outline'}
              size={size ?? 22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="meals"
        options={{
          title: 'Meals',
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons
              name={focused ? 'restaurant' : 'restaurant-outline'}
              size={size ?? 22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="report"
        options={{
          title: 'My Progress',
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons
              name={focused ? 'stats-chart' : 'stats-chart-outline'}
              size={size ?? 22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons
              name={focused ? 'settings' : 'settings-outline'}
              size={size ?? 22}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    backgroundColor: T.white,
    borderTopColor: T.border,
    borderTopWidth: 1,
    paddingTop: 8,
    position: 'relative',
    ...cardShadow,
  },
  slidingIndicator: {
    position: 'absolute',
    top: 0,
    height: 3,
    zIndex: 10,
  },
  indicatorGradient: {
    flex: 1,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    shadowColor: T.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  iconContainer: {
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 11,
    marginTop: 2,
    letterSpacing: -0.1,
  },
});
