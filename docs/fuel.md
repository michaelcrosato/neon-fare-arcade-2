# Fuel, stores, and the included apartment

Both vehicles have a finite petrol tank in Arcade Shift, arcade Free Run, and
simulation Free Run. Fuel follows the selected vehicle between sessions; a new
run does not give a free tank. Existing careers receive full tanks once when
their save is migrated. Each vehicle retains its own level.

## Vehicle references

| Vehicle | Tank | Combined consumption | Implied full-tank range |
| --- | ---: | ---: | ---: |
| 1996 Ford Crown Victoria 4.6 V8, 4-speed automatic | 75.7 L (20 US gal) | 18 US mpg, converted to 13.067 L/100 km | about 579 km |
| 2015 Honda Accord Coupe V6, 6-speed manual | 65 L | 10.9 L/100 km | about 596 km |

The ranges are calculated as `tank litres / combined L/100 km × 100`, not
manufacturer promises. The Accord's automatic-shifting assist still uses its
six-speed manual vehicle specification.

Primary references, checked September 14, 2026:

- [EPA/DOE Crown Victoria record 12885](https://www.fueleconomy.gov/ws/rest/vehicle/12885)
  identifies the 1996 4.6 L V8 automatic and supplies 15 city / 23 highway /
  18 combined US mpg. The conversion uses 235.214583 divided by US mpg.
- [Ford 1996 Crown Victoria owner guide](https://www.fordservicecontent.com/Ford_Content/catalog/owner_guides/96croog1e.pdf)
  describes the 20 US gallon fuel display; 20 US gallons converts to 75.708 L.
- [Honda Canada 2015 Accord Coupe specifications](https://www.honda.ca/Content/honda.ca/en/2015/accord_coupe/ex_10291/GenericLink/Accord_Coupe_specs_EN.pdf)
  gives the V6 manual's 13.0 city / 8.4 highway / 10.9 combined L/100 km and
  65 L tank.
- [DOE speed and fuel economy study](https://www.energy.gov/cmei/vehicles/articles/fotw-1155-october-12-2020-light-duty-vehicles-use-more-gas-speeds-above-50)
  reports worse economy at higher speeds. The game's exact penalty below is
  an authored rule requested for play, not a measured claim about either car.

## Consumption and roadside service

Distance uses resolved taxi travel in the GPS's metre scale. Walking, browsing
paused menus, and spending time inside do not burn fuel. An idling occupied cab
uses an authored 1.2 L/hour for the Crown or 0.9 L/hour for the Accord.

The HUD shows litres, percentage, estimated remaining range, and the current
road's speed limit. Authored limits are 100 km/h on highways, 80 on parkways,
60 on boulevards, 30 at roundabouts/in Cedar Vale/off road, and 50 on other
streets and ramps. The canonical road projection determines road class.

Consumption increases smoothly above the limit: 1× at the limit, 1.5× at 25%
over, and 2× at 50% over or faster. Sustained 2× consumption halves the estimated
range to about 290/298 km. Arcade boost adds another 20% while active. The
range display is an estimate at the present consumption multiplier.

At 12% fuel the gauge warns once. Empty tanks cut forward/reverse engine power,
cruise, boost, and engine audio while preserving steering, braking, and coasting.
The existing pause-menu tow provides 5 L only when the tank is empty, preserving
the existing $100 tow charge and free low-fare rescue policy.

GO-GO GAS uses original dark-teal/yellow branding on all existing gas venues.
Stop on a station's service lot for a fuel/repair offer, or use its indoor
counter. F fills the tank; touch buttons offer a full fill or up to 5 L. N
dismisses the lot offer until the taxi leaves and returns. Fuel costs an
authored $2/L, rounded up to whole fare dollars for the delivered amount. It
uses current run fare first, then banked fare. Transactions revalidate motion,
location, capacity and funds. Repairs retain their run-fare payment rule.

Fuel saves every five seconds during an active session and on visibility,
page exit, run replacement, refueling, and banking. Development playtest fuel
consumption is not saved.

## Home and shopping

Neon Lofts is included for new players and granted to existing careers without
deducting fare. It begins with a mattress, kitchen counter, desk and trophy wall.
Sixteen purchases add visible household models, appliances and furniture.

Four existing city shop parcels become branded big-box-inspired stores with
original pixel logos, broad storefronts, parking markings and product showrooms:

| Store | City block | Stock |
| --- | --- | --- |
| BEST BYTE | 5, −4 | TV, stereo, washer, microwave |
| COST-GO | 0, −8 | Fridge, coffee maker, vacuum, pantry |
| WOW MART | −4, 8 | Lamp, rug, plant, dining set |
| I-KIT | −8, −7 | Sofa, bed frame, bookcase, side table |

The GPS shopping directory sets routes to actual doors and also offers home
and city fuel-stop shortcuts. Enter the store and use the counter to purchase
with banked fare. Every purchase includes immediate placement in a safe fixed
slot at the apartment. Home Hub can store or place owned items without buying
again. Ownership and placement persist in the career save. Both renderers use
the same furniture and brand geometry; lettering compensates for the game's
existing horizontal projection convention in every camera.
