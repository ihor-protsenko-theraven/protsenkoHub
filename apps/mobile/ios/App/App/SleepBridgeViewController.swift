import Capacitor

public class SleepBridgeViewController: CAPBridgeViewController {
    override public func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(SleepWidgetPlugin())
    }
}
