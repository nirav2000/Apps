"""Unit tests require only Python 3.9+; do not contact any devices."""
import unittest
from datetime import datetime, timezone
from unittest.mock import Mock
import export_ha_history as m


START = datetime(2026, 11, 10, 0, 0, tzinfo=timezone.utc)
END = datetime(2026, 11, 10, 3, 0, tzinfo=timezone.utc)


def signal(time, value):
    return {"last_changed": "2026-11-10T" + time + ":00Z", "state": value}


class HistoryTests(unittest.TestCase):
    def test_unseen_prefix_and_unknown_unavailable(self):
        rows = [
            signal("01:00", "on"), signal("02:00", "unavailable"),
            signal("02:30", "off")
        ]
        out = m.states_to_intervals("zone", rows, START, END, {})
        self.assertEqual([(r["state"],r["start"][-9:-1],r["end"][-9:-1]) for r in out],
                         [("unknown","00:00:00","01:00:00"),("on","01:00:00","02:00:00"),
                          ("unknown","02:00:00","02:30:00"),("off","02:30:00","03:00:00")])

    def test_no_history_is_unknown_not_off(self):
        out = m.states_to_intervals("zone", [], START, END, {})
        self.assertEqual(len(out),1)
        self.assertEqual(out[0]["state"],"unknown")

    def test_fresh_initial_state_and_duplicate_events_are_coalesced(self):
        rows = [signal("00:00","on"),signal("01:00","on"),signal("02:00","off")]
        out=m.states_to_intervals("zone",rows,START,END,{})
        self.assertEqual([x["state"] for x in out],["on","off"])
        self.assertEqual(out[0]["end"],"2026-11-10T02:00:00Z")

    def test_climate_attribute_is_not_assumed_when_absent(self):
        record=signal("01:00","heat")
        out=m.states_to_intervals("zone",[record],START,END,
                                 {"signal_attribute":"hvac_action","on_values":["heating"],"off_values":["idle","off"]})
        self.assertEqual(out[-1]["state"],"unknown")

    def test_on_off_values_can_be_configured(self):
        out=m.states_to_intervals("zone",[signal("00:00","heating"),signal("01:00","idle")],
                                 START,END,{"on_values":["heating"],"off_values":["idle"]})
        self.assertEqual([x["state"] for x in out],["on","off"])

    def test_local_http_only(self):
        self.assertEqual(m.safe_url("http://homeassistant.local:8123"),"http://homeassistant.local:8123")
        with self.assertRaises(ValueError):
            m.safe_url("http://example.com:8123")

    def test_export_with_missing_warmup_signal_returns_unknown(self):
        fake=Mock()
        fake.history.return_value=[signal("00:00","on"),signal("01:00","off")]
        fake.current.return_value={"state":"20.5","attributes":{"temperature":21.0}}
        conf={"zones":[
          {"id":"wiser1","name":"Wiser zone","provider":"wiser","energyType":"gas",
           "signal_entity":"binary_sensor.heating","current_entity":"sensor.temperature"},
          {"id":"ufh1","name":"UFH","provider":"warmup","energyType":"electric"}
        ]}
        data=m.export(conf,fake,END,1)
        self.assertEqual(len(data["zones"]),2)
        states={z:[] for z in ("wiser1","ufh1")}
        for x in data["intervals"]:states[x["zoneId"]].append(x["state"])
        self.assertEqual(states["ufh1"],["unknown"])
        self.assertEqual(data["zones"][0]["current"],20.5)
        self.assertEqual(data["source"],"private-home-assistant-history-exporter")


if __name__=="__main__":
    unittest.main()
