package expo.modules.stepcapability

import android.content.Context
import android.content.pm.PackageManager
import android.hardware.Sensor
import android.hardware.SensorManager
import android.os.Build
import android.os.ext.SdkExtensions
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
  }
}
