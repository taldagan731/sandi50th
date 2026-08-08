export function SandiSignaturePrelude() {
  return (
    <div className="sandiSignaturePrelude" aria-label="Sandi" role="img">
      <svg viewBox="0 0 940 360" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="sandi-flow" x1="0" y1="0" x2="1" y2=".7">
            <stop offset="0" stopColor="#ff826f" />
            <stop offset=".28" stopColor="#ffc08d" />
            <stop offset=".51" stopColor="#a8e4c2" />
            <stop offset=".75" stopColor="#a9a8ff" />
            <stop offset="1" stopColor="#ff7797" />
          </linearGradient>
          <mask id="sandi-write" maskUnits="userSpaceOnUse" x="0" y="0" width="940" height="360">
            <g fill="none" stroke="#fff" strokeLinecap="round" strokeLinejoin="round">
              <path className="sandiStroke stroke-s" pathLength="100" strokeWidth="23" d="M256 81 C208 31 105 37 74 99 C37 173 192 169 219 222 C256 296 137 339 58 281 C37 265 29 245 36 228" />
              <path className="sandiStroke stroke-a" pathLength="100" strokeWidth="18" d="M244 243 C250 191 292 163 326 182 C360 201 347 251 311 265 C277 278 251 258 258 225 C267 190 315 178 340 205 C350 217 350 239 354 257" />
              <path className="sandiStroke stroke-n" pathLength="100" strokeWidth="20" d="M354 257 C360 225 362 197 365 177 C360 205 363 252 377 255 C396 258 397 198 421 181 C441 166 454 187 450 218 L445 258" />
              <path className="sandiStroke stroke-d" pathLength="100" strokeWidth="17" d="M458 234 C466 192 511 178 538 200 C561 219 548 257 520 267 C490 279 468 258 476 228 C484 197 519 184 544 202 C563 216 566 243 570 259 C567 220 568 153 583 101" />
              <path className="sandiStroke stroke-i" pathLength="100" strokeWidth="16" d="M594 204 C591 225 590 246 596 258 C605 273 625 257 636 242" />
              <path className="sandiStroke stroke-dot" pathLength="100" strokeWidth="18" d="M604 166 C611 162 617 164 618 171 C617 179 606 182 601 176 C598 172 600 168 604 166" />
              <path className="sandiStroke stroke-flourish" pathLength="100" strokeWidth="12" d="M633 243 C677 218 718 224 755 251 C788 274 837 273 900 229" />
            </g>
          </mask>
        </defs>
        <g mask="url(#sandi-write)">
          <rect className="sandiColourFlow" x="-420" y="0" width="1780" height="360" fill="url(#sandi-flow)" />
          <rect className="sandiBrushLight" x="0" y="0" width="940" height="360" fill="none" />
        </g>
      </svg>
    </div>
  );
}
