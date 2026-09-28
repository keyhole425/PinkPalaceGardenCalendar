/**
 * A real South Australian precis forecast, captured from the Bureau on
 * 28 September 2026 and kept word for word.
 *
 * Hand-rolled parsing earns a real payload to parse. This one happens to
 * carry every edge the parser has to survive: a first period that is only the
 * remainder of today and so has no temperatures, two different precipitation
 * ranges, days with no range at all, and a daylight-saving change partway
 * through the week that moves the UTC offset from +09:30 to +10:30.
 *
 * The leading area is a decoy, so the test proves the parser finds Adelaide
 * rather than merely finding the first forecast in the file.
 */
export const BOM_SA_PRECIS = `<?xml version="1.0" encoding="UTF-8"?>
<product version="1.7">
<amoc>
<identifier>IDS10044</identifier>
<issue-time-local tz="CST">2026-09-28T16:21:07+09:30</issue-time-local>
</amoc>
<forecast>
<area aac="SA_FA001" description="South Australia" type="region"/>
<area aac="SA_PW001" description="Adelaide Metropolitan" type="public-district" parent-aac="SA_FA001"/>
<area aac="SA_PT002" description="Port Lincoln" type="location" parent-aac="SA_PW002">
<forecast-period index="1" start-time-local="2026-09-29T00:00:00+09:30">
<element type="forecast_icon_code">12</element>
<element type="air_temperature_minimum" units="Celsius">7</element>
<element type="air_temperature_maximum" units="Celsius">14</element>
<text type="precis">Rain.</text>
</forecast-period>
</area>
<area aac="SA_PT001" description="Adelaide" type="location" parent-aac="SA_PW001">
            <forecast-period index="0" start-time-local="2026-09-28T15:00:00+09:30" end-time-local="2026-09-29T00:00:00+09:30" start-time-utc="2026-09-28T05:30:00Z" end-time-utc="2026-09-28T14:30:00Z">
                <element type="forecast_icon_code">3</element>
                <text type="precis">Partly cloudy.</text>
                <text type="probability_of_precipitation">5%</text>
            </forecast-period>
            <forecast-period index="1" start-time-local="2026-09-29T00:00:00+09:30" end-time-local="2026-09-30T00:00:00+09:30" start-time-utc="2026-09-28T14:30:00Z" end-time-utc="2026-09-29T14:30:00Z">
                <element type="forecast_icon_code">3</element>
                <element type="air_temperature_minimum" units="Celsius">19</element>
                <element type="air_temperature_maximum" units="Celsius">32</element>
                <text type="precis">Partly cloudy.</text>
                <text type="probability_of_precipitation">10%</text>
            </forecast-period>
            <forecast-period index="2" start-time-local="2026-09-30T00:00:00+09:30" end-time-local="2026-10-01T00:00:00+09:30" start-time-utc="2026-09-29T14:30:00Z" end-time-utc="2026-09-30T14:30:00Z">
                <element type="forecast_icon_code">11</element>
                <element type="precipitation_range">0 to 1 mm</element>
                <element type="air_temperature_minimum" units="Celsius">17</element>
                <element type="air_temperature_maximum" units="Celsius">25</element>
                <text type="precis">Shower or two.</text>
                <text type="probability_of_precipitation">50%</text>
            </forecast-period>
            <forecast-period index="3" start-time-local="2026-10-01T00:00:00+09:30" end-time-local="2026-10-02T00:00:00+09:30" start-time-utc="2026-09-30T14:30:00Z" end-time-utc="2026-10-01T14:30:00Z">
                <element type="forecast_icon_code">11</element>
                <element type="precipitation_range">3 to 10 mm</element>
                <element type="air_temperature_minimum" units="Celsius">15</element>
                <element type="air_temperature_maximum" units="Celsius">21</element>
                <text type="precis">Showers.</text>
                <text type="probability_of_precipitation">95%</text>
            </forecast-period>
            <forecast-period index="4" start-time-local="2026-10-02T00:00:00+09:30" end-time-local="2026-10-03T00:00:00+09:30" start-time-utc="2026-10-01T14:30:00Z" end-time-utc="2026-10-02T14:30:00Z">
                <element type="forecast_icon_code">3</element>
                <element type="air_temperature_minimum" units="Celsius">11</element>
                <element type="air_temperature_maximum" units="Celsius">18</element>
                <text type="precis">Partly cloudy.</text>
                <text type="probability_of_precipitation">20%</text>
            </forecast-period>
            <forecast-period index="5" start-time-local="2026-10-03T00:00:00+09:30" end-time-local="2026-10-04T00:00:00+09:30" start-time-utc="2026-10-02T14:30:00Z" end-time-utc="2026-10-03T14:30:00Z">
                <element type="forecast_icon_code">3</element>
                <element type="air_temperature_minimum" units="Celsius">10</element>
                <element type="air_temperature_maximum" units="Celsius">21</element>
                <text type="precis">Partly cloudy.</text>
                <text type="probability_of_precipitation">10%</text>
            </forecast-period>
            <forecast-period index="6" start-time-local="2026-10-04T00:00:00+09:30" end-time-local="2026-10-05T00:00:00+10:30" start-time-utc="2026-10-03T14:30:00Z" end-time-utc="2026-10-04T13:30:00Z">
                <element type="forecast_icon_code">3</element>
                <element type="air_temperature_minimum" units="Celsius">10</element>
                <element type="air_temperature_maximum" units="Celsius">20</element>
                <text type="precis">Partly cloudy.</text>
                <text type="probability_of_precipitation">20%</text>
            </forecast-period>
            <forecast-period index="7" start-time-local="2026-10-05T00:00:00+10:30" end-time-local="2026-10-06T00:00:00+10:30" start-time-utc="2026-10-04T13:30:00Z" end-time-utc="2026-10-05T13:30:00Z">
                <element type="forecast_icon_code">3</element>
                <element type="air_temperature_minimum" units="Celsius">10</element>
                <element type="air_temperature_maximum" units="Celsius">21</element>
                <text type="precis">Partly cloudy.</text>
                <text type="probability_of_precipitation">20%</text>
            </forecast-period>
        </area>
</forecast>
</product>`;
