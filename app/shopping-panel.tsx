"use client";

import { BRANDS, CITY_STORES, isStoreId } from "@/game/brands";
import { FURNISHINGS } from "@/game/furnishing-catalog";
import { BrandLogo } from "./brand-logo";
import { FurnishingThumbnail } from "./furnishing-thumbnail";
import { useCommerce } from "./game-commerce";

export function StoreDirectory() {
  const commerce = useCommerce();
  if (!commerce) return null;
  return <section className="store-directory" aria-label="Home shopping destinations">
    <div><small>NEON CITY // SHOPPING RUN</small><h3>MAKE YOURSELF AT HOME.</h3><p>Visit a store counter. Everything includes delivery to Neon Lofts.</p></div>
    <div className="store-directory__links">{CITY_STORES.map(({ id }) => <button key={id} type="button" onClick={() => commerce.route(id)} aria-label={`Set GPS to ${BRANDS[id].name}`}>
      <BrandLogo brand={id} /><span>{BRANDS[id].department}<b>SET GPS ↗</b></span>
    </button>)}</div>
    <div className="store-directory__essentials"><button onClick={() => commerce.route("home")}>NEON LOFTS · GPS HOME ↗</button><button onClick={() => commerce.route("gas")}>GO-GO GAS · CITY FUEL STOP ↗</button></div>
  </section>;
}

export function ShoppingPanel({ onClose }: { onClose: () => void }) {
  const commerce = useCommerce();
  if (!commerce || !isStoreId(commerce.hud.venueBrand)) return null;
  const { career, buy, notice } = commerce, brand = commerce.hud.venueBrand;
  return <div className="home-shop">
    <header className="home-shop__header"><div><BrandLogo brand={brand} /><p>{BRANDS[brand].slogan}</p>
      <h2 id="modal-title">GOOD STUFF. YOUR PLACE.</h2></div><div className="home-wallet"><small>BANKED FARE</small><strong>${career.bank}</strong><span>DELIVERY INCLUDED</span></div></header>
    <div className="furnishing-grid">{FURNISHINGS.filter(item => item.store === brand).map(item => {
      const owned = career.furnishings.owned.includes(item.id), shortfall = Math.max(0, item.cost - career.bank);
      return <article className={`furnishing-card ${owned ? "is-owned" : ""}`} key={item.id} aria-label={item.name}>
        <div className="furnishing-card__art"><FurnishingThumbnail id={item.id} /><b>${item.cost}</b></div>
        <h3>{item.name}</h3><p>{item.description}</p><button type="button" disabled={owned || shortfall > 0} onClick={() => buy(item.id)}>
          {owned ? "YOURS · DELIVERED" : shortfall ? `NEED $${shortfall} MORE` : `BUY + DELIVER · $${item.cost}`}</button>
      </article>;
    })}</div>
    <p className="commerce-notice" role="status">{notice || "Buy here. Find it at home. You can place or store owned items at your apartment's home hub."}</p>
    <footer className="home-shop__footer"><p>End a run to bank its fare for your next shopping trip.</p><button className="primary-small" onClick={onClose}>BACK TO THE STORE</button></footer>
  </div>;
}

export function HomeFurnishings() {
  const commerce = useCommerce();
  if (!commerce) return null;
  const { career, place, notice } = commerce;
  const items = FURNISHINGS.filter(item => career.furnishings.owned.includes(item.id));
  return <section className="home-furnishings" aria-label="Apartment furnishings">
    <small>YOUR APARTMENT // {items.length} OF {FURNISHINGS.length} FINDS</small><h3>A PLACE BETWEEN SHIFTS.</h3>
    <p>The loft is yours from day one. Shop around the city to fill it with your own things.</p>
    {items.length ? <div className="furnishing-grid is-inventory">{items.map(item => {
      const placed = career.furnishings.placed.includes(item.id);
      return <article className="furnishing-card" key={item.id} aria-label={item.name}>
        <div className="furnishing-card__art"><FurnishingThumbnail id={item.id} /></div><h4>{item.name}</h4>
        <button type="button" aria-pressed={placed} onClick={() => place(item.id, !placed)}>{placed ? "IN ROOM · STORE ITEM" : "IN STORAGE · PLACE ITEM"}</button>
      </article>;
    })}</div> : <p className="home-furnishings__empty">A mattress, a kitchen counter, a desk… and plenty of room for a first find.</p>}
    {notice && <p className="commerce-notice" role="status">{notice}</p>}
    <StoreDirectory />
  </section>;
}
