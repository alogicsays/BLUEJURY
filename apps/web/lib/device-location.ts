import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";

export type DevicePosition = {
  latitude: number;
  longitude: number;
  accuracy: number;
};

export type DeviceLocationOptions = {
  enableHighAccuracy?: boolean;
  maximumAge?: number;
  timeout?: number;
};

export class LocationPermissionDeniedError extends Error {}

async function ensureNativePermission(): Promise<void> {
  let permission = await Geolocation.checkPermissions();
  if (permission.location !== "granted" && permission.coarseLocation !== "granted") {
    permission = await Geolocation.requestPermissions();
  }
  if (permission.location !== "granted" && permission.coarseLocation !== "granted") {
    throw new LocationPermissionDeniedError("Location permission was denied.");
  }
}

function coordinates(position: { coords: Pick<GeolocationCoordinates, "latitude" | "longitude" | "accuracy"> }): DevicePosition {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy,
  };
}

export async function getForegroundPosition(
  options: DeviceLocationOptions,
): Promise<DevicePosition> {
  if (Capacitor.isNativePlatform()) {
    await ensureNativePermission();
    const position = await Geolocation.getCurrentPosition(options);
    return coordinates(position);
  }
  if (!navigator.geolocation) throw new Error("Location is unavailable on this device.");
  return new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(
    position => resolve(coordinates(position)),
    error => reject(error.code === error.PERMISSION_DENIED
      ? new LocationPermissionDeniedError(error.message)
      : error),
    options,
  ));
}

export async function watchForegroundPosition(
  options: DeviceLocationOptions,
  onPosition: (position: DevicePosition) => void,
  onError: (error: unknown) => void,
): Promise<() => Promise<void>> {
  if (Capacitor.isNativePlatform()) {
    await ensureNativePermission();
    const id = await Geolocation.watchPosition(options, (position, error) => {
      if (error) onError(error);
      else if (position) onPosition(coordinates(position));
    });
    return () => Geolocation.clearWatch({ id });
  }
  if (!navigator.geolocation) throw new Error("Location is unavailable on this device.");
  const id = navigator.geolocation.watchPosition(
    position => onPosition(coordinates(position)),
    error => onError(error.code === error.PERMISSION_DENIED
      ? new LocationPermissionDeniedError(error.message)
      : error),
    options,
  );
  return async () => navigator.geolocation.clearWatch(id);
}
