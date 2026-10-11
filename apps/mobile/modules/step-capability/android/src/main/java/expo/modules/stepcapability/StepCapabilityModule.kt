package expo.modules.stepcapability

import android.content.Context
import android.content.pm.PackageManager
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.ext.SdkExtensions
import java.util.concurrent.atomic.AtomicBoolean
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Authoritative on-device step-collection capability check.
 *
 * Health Connect counts the phone's OWN steps only on Android 14 (API 34) with
 * SDK extension >= 20, and only if the device has a TYPE_STEP_COUNTER sensor
 * (see https://developer.android.com/health-and-fitness/health-connect/features/steps).
 * None of these three facts are readable from JS, so they are reported here.
 *
 * This does NOT say whether Health Connect is installed, whether permission is
 * granted, or whether any records exist — those are separate states handled in
 * lib/stepsHealthConnect.ts. It answers only: "could this device natively
 * collect its own steps at all?"
 */
class StepCapabilityModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("StepCapability")

    Function("getStepCapability") {
      val context = appContext.reactContext ?: throw IllegalStateException("No React context")
      val apiLevel = Build.VERSION.SDK_INT

      // SdkExtensions is API 30+. Below that the extension is irrelevant
      // (on-device counting requires API 34 anyway), so report 0.
      val sdkExtension34 = if (apiLevel >= Build.VERSION_CODES.R) {
        try {
          SdkExtensions.getExtensionVersion(Build.VERSION_CODES.UPSIDE_DOWN_CAKE)
        } catch (e: Exception) {
          0
        }
      } else {
        0
      }

      val sensorManager = context.getSystemService(Context.SENSOR_SERVICE) as? SensorManager
      val hasSensor = sensorManager?.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) != null
      val hasFeature =
        context.packageManager.hasSystemFeature(PackageManager.FEATURE_SENSOR_STEP_COUNTER)

      mapOf(
        "apiLevel" to apiLevel,
        "sdkExtension34" to sdkExtension34,
        "hasStepCounterSensor" to (hasSensor || hasFeature)
      )
    }

    // Reads the hardware TYPE_STEP_COUNTER's current cumulative value (steps
    // since last reboot). This is the ONLY way to auto-collect steps on
    // Android < 14, where Health Connect does no native counting
    // (lib/stepsCapability.ts). The raw since-boot value is returned as-is;
    // all midnight-baseline / per-day math lives in JS (lib/stepsNativeCounter.ts)
    // so it stays unit-testable without a device.
    //
    // TYPE_STEP_COUNTER only emits on a detected step, and some OEMs do not
    // flush the current value on registration — so a stationary device may
    // produce no event. We wait up to 8s and then resolve null (caller treats
    // null as 'unavailable' and falls through to the OCR/photo path), rather
    // than hanging the sync forever.
    AsyncFunction("readStepCounter") { promise: Promise ->
      val context = appContext.reactContext
      val sensorManager = context?.getSystemService(Context.SENSOR_SERVICE) as? SensorManager
      val sensor = sensorManager?.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)
      if (sensorManager == null || sensor == null) {
        promise.resolve(null)
        return@AsyncFunction
      }

      val settled = AtomicBoolean(false)
      val handler = Handler(Looper.getMainLooper())
      var listener: SensorEventListener? = null

      val timeout = Runnable {
        if (settled.compareAndSet(false, true)) {
          listener?.let { sensorManager.unregisterListener(it) }
          promise.resolve(null)
        }
      }

      listener = object : SensorEventListener {
        override fun onSensorChanged(event: SensorEvent) {
          if (settled.compareAndSet(false, true)) {
            handler.removeCallbacks(timeout)
            sensorManager.unregisterListener(this)
            promise.resolve(event.values[0].toDouble())
          }
        }
        override fun onAccuracyChanged(s: Sensor?, a: Int) {}
      }

      sensorManager.registerListener(listener, sensor, SensorManager.SENSOR_DELAY_UI)
      handler.postDelayed(timeout, 8000)
    }
  }
}
