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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, fontFamily, translucentCardShadow } from '../../lib/design-system';

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
          // Float the capsule above the device's safe-area bottom inset
          // (home indicator / gesture-nav bar) instead of sitting flush
          // against it.
          bottom: insets.bottom + 16,
        },
      ]}
    >
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
    // Floating capsule: lifted off the screen edges and above the safe
    // area (see the inline `bottom` offset above), translucent frosted
    // fill, fully rounded, no top border line.
    backgroundColor: 'rgba(255,255,255,0.85)',
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: 32,
    paddingTop: 10,
    paddingBottom: 10,
    zIndex: 20,
    ...translucentCardShadow,
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
