  /* ── ShelbyUSD Balance System — FA v2 via shelby_token::metadata() ── */

  // Cache metadata object address setelah ditemukan
  let _cachedShbyMetadataAddr = null;
  let _cachedShbyDecimals = 6;

  /* Helper: call view function via /api/view proxy */
  async function callView(func, typeArgs, args) {
    const r = await fetch('/api/view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ function: func, type_arguments: typeArgs, arguments: args })
    });
    if (!r.ok) throw new Error('view call failed: ' + r.status);
    return r.json();
  }

  /* Helper: fetch all account resources via /api/resources proxy */
  async function fetchAccountResources(address) {
    try {
      const r = await fetch('/api/resources?address=' + encodeURIComponent(address));
      if (!r.ok) return [];
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    } catch(e) {
      console.warn('[resources] fetch failed:', e.message);
      return [];
    }
  }

  /* ── Ambil metadata object address dari shelby_token::metadata() ──
   * shelby_token::metadata() adalah fungsi resmi dari contract sendiri
   * yang return Object<FungibleAsset::Metadata> — inilah yang dipakai
   * sebagai argument ke primary_fungible_store::balance(owner, metadata_obj)
   */
  async function getShbyMetadataAddress() {
    if (_cachedShbyMetadataAddr) return _cachedShbyMetadataAddr;

    // Strategy 1: Panggil shelby_token::metadata() — cara paling direct & benar
    try {
      const result = await callView(
        SHELBY_CONTRACT + '::shelby_token::metadata',
        [],
        []
      );
      console.log('[SHBY] shelby_token::metadata() raw result:', result);

      // Result bisa: ["0xABC..."] atau [{ inner: "0xABC..." }] atau { inner: "0xABC..." }
      let metaAddr = null;
      if (Array.isArray(result)) {
        const first = result[0];
        if (typeof first === 'string') {
          metaAddr = first;
        } else if (first && typeof first === 'object') {
          metaAddr = first.inner ?? first.handle ?? first.self ?? Object.values(first)[0];
        }
      } else if (result && typeof result === 'object') {
        metaAddr = result.inner ?? result.handle ?? result.self ?? Object.values(result)[0];
      }

      if (metaAddr && typeof metaAddr === 'string' && metaAddr.startsWith('0x')) {
        _cachedShbyMetadataAddr = metaAddr;
        console.log('[SHBY] ✅ Metadata address from shelby_token::metadata():', metaAddr);
        return metaAddr;
      }
    } catch(e) {
      console.warn('[SHBY] shelby_token::metadata() failed:', e.message);
    }

    // Strategy 2: shelby_token::shelby_address() — fungsi lain di module yang sama
    try {
      const result = await callView(
        SHELBY_CONTRACT + '::shelby_token::shelby_address',
        [],
        []
      );
      console.log('[SHBY] shelby_token::shelby_address() raw result:', result);
      const addr = Array.isArray(result) ? result[0] : result;
      if (addr && typeof addr === 'string' && addr.startsWith('0x')) {
        _cachedShbyMetadataAddr = addr;
        console.log('[SHBY] ✅ Metadata address from shelby_address():', addr);
        return addr;
      }
    } catch(e) {
      console.warn('[SHBY] shelby_token::shelby_address() failed:', e.message);
    }

    // Strategy 3: Scan contract resources untuk 0x1::fungible_asset::Metadata
    try {
      console.log('[SHBY] Scanning contract resources for FA Metadata...');
      const contractResources = await fetchAccountResources(SHELBY_CONTRACT);
      console.log('[SHBY] Contract resources count:', contractResources.length);
      contractResources.forEach(r => console.log('[SHBY] contract resource:', r.type));

      const metaResource = contractResources.find(r =>
        r.type === '0x1::fungible_asset::Metadata' ||
        r.type?.includes('fungible_asset::Metadata')
      );
      if (metaResource) {
        _cachedShbyMetadataAddr = SHELBY_CONTRACT;
        console.log('[SHBY] ✅ FA Metadata found at contract address itself');
        return SHELBY_CONTRACT;
      }

      const objectCore = contractResources.find(r =>
        r.type === '0x1::object::ObjectCore'
      );
      if (objectCore) {
        _cachedShbyMetadataAddr = SHELBY_CONTRACT;
        console.log('[SHBY] ✅ Contract is an Object, using as metadata addr');
        return SHELBY_CONTRACT;
      }
    } catch(e) {
      console.warn('[SHBY] Contract resource scan failed:', e.message);
    }

    console.warn('[SHBY] Could not determine metadata address');
    return null;
  }

  /* ── Fetch SHBY_USD balance via FA v2 primary_fungible_store ── */
  async function fetchShelbyUsdBalance(address) {

    // ── Strategy A (UTAMA): shelby_token::metadata() + primary_fungible_store::balance ──
    try {
      const metaAddr = await getShbyMetadataAddress();
      if (metaAddr) {
        // A1: dengan type argument Metadata
        try {
          const result = await callView(
            '0x1::primary_fungible_store::balance',
            ['0x1::fungible_asset::Metadata'],
            [address, metaAddr]
          );
          console.log('[SHBY] Strategy A1 result:', result);
          if (Array.isArray(result) && result[0] !== undefined) {
            const raw = parseInt(result[0]);
            if (raw >= 0) {
              console.log('[SHBY] ✅ Strategy A1 SUCCESS → raw:', raw, '→', raw / 1e6);
              return raw / 1e6;
            }
          }
        } catch(e) { console.warn('[SHBY] Strategy A1 failed:', e.message); }

        // A2: tanpa type argument
        try {
          const result = await callView(
            '0x1::primary_fungible_store::balance',
            [],
            [address, metaAddr]
          );
          console.log('[SHBY] Strategy A2 (no type arg) result:', result);
          if (Array.isArray(result) && result[0] !== undefined) {
            const raw = parseInt(result[0]);
            if (raw >= 0) {
              console.log('[SHBY] ✅ Strategy A2 SUCCESS → raw:', raw, '→', raw / 1e6);
              return raw / 1e6;
            }
          }
        } catch(e) { console.warn('[SHBY] Strategy A2 failed:', e.message); }

        // A3: cek store exists dulu baru ambil balance
        try {
          const exists = await callView(
            '0x1::primary_fungible_store::primary_store_exists',
            ['0x1::fungible_asset::Metadata'],
            [address, metaAddr]
          );
          console.log('[SHBY] Strategy A3 store_exists:', exists);
          if (Array.isArray(exists) && exists[0] === true) {
            const result = await callView(
              '0x1::primary_fungible_store::balance',
              ['0x1::fungible_asset::Metadata'],
              [address, metaAddr]
            );
            if (Array.isArray(result) && result[0] !== undefined) {
              const raw = parseInt(result[0]);
              console.log('[SHBY] ✅ Strategy A3 SUCCESS → raw:', raw, '→', raw / 1e6);
              return raw / 1e6;
            }
          }
        } catch(e) {}
      }
    } catch(e) {
      console.warn('[SHBY] Strategy A block error:', e.message);
    }

    // ── Strategy B: Scan wallet FungibleStore resources langsung ──
    try {
      const walletResources = await fetchAccountResources(address);
      const faStores = walletResources.filter(r =>
        r.type?.includes('0x1::fungible_asset::FungibleStore')
      );
      console.log('[SHBY] Strategy B: FungibleStore count in wallet:', faStores.length);

      for (const store of faStores) {
        const meta = store.data?.metadata?.inner ?? store.data?.metadata ?? '';
        if (meta && !meta.includes('0000000000000000000000000000000000000000000000000000000000000001')) {
          if (!_cachedShbyMetadataAddr) _cachedShbyMetadataAddr = meta;
        }
        if (meta && meta.toLowerCase().includes(SHELBY_CONTRACT.toLowerCase())) {
          const bal = parseInt(store.data?.balance ?? store.data?.amount ?? '0');
          console.log('[SHBY] ✅ Strategy B matched store by contract addr → bal:', bal);
          return bal / Math.pow(10, _cachedShbyDecimals);
        }
        if (_cachedShbyMetadataAddr && meta === _cachedShbyMetadataAddr) {
          const bal = parseInt(store.data?.balance ?? store.data?.amount ?? '0');
          console.log('[SHBY] ✅ Strategy B matched cached metadata addr → bal:', bal);
          return bal / Math.pow(10, _cachedShbyDecimals);
        }
      }

      // Fallback: 1 non-APT FungibleStore pasti SHBY
      const nonApt = faStores.filter(s => {
        const meta = s.data?.metadata?.inner ?? s.data?.metadata ?? '';
        return !meta.toLowerCase().includes('0000000000000000000000000000000000000000000000000000000000000001');
      });
      if (nonApt.length === 1) {
        const bal = parseInt(nonApt[0].data?.balance ?? nonApt[0].data?.amount ?? '0');
        if (bal > 0) {
          console.log('[SHBY] ✅ Strategy B single non-APT store → bal:', bal);
          return bal / Math.pow(10, _cachedShbyDecimals);
        }
      }
    } catch(e) {
      console.warn('[SHBY] Strategy B failed:', e.message);
    }

    // ── Strategy C: /api/balance server-side FA scan ──
    try {
      const r = await fetch('/api/balance?address=' + encodeURIComponent(address) + '&mode=fa');
      if (r.ok) {
        const data = await r.json();
        const raw = parseInt(data.value || '0');
        if (raw > 0) {
          console.log('[SHBY] ✅ Strategy C /api/balance FA →', raw / Math.pow(10, _cachedShbyDecimals));
          return raw / Math.pow(10, _cachedShbyDecimals);
        }
      }
    } catch(e) {}

    // ── Strategy D: /api/balance full scan ──
    try {
      const r = await fetch('/api/balance?address=' + encodeURIComponent(address) + '&scan=full');
      if (r.ok) {
        const data = await r.json();
        const raw = parseInt(data.value || '0');
        if (raw > 0) {
          console.log('[SHBY] ✅ Strategy D full scan →', raw / Math.pow(10, _cachedShbyDecimals));
          return raw / Math.pow(10, _cachedShbyDecimals);
        }
      }
    } catch(e) {}

    console.warn('[SHBY] All strategies failed — balance = 0');
    return 0;
  }

  /* APT balance via view function */
  async function fetchAptBalance(address) {
    try {
      const result = await callView('0x1::coin::balance', ['0x1::aptos_coin::AptosCoin'], [address]);
      if (Array.isArray(result) && result[0] !== undefined) {
        const raw = parseInt(result[0]);
        console.log('[APT] view coin::balance →', raw / 1e8);
        if (raw >= 0) return raw / 1e8;
      }
    } catch(e) {}

    try {
      const result = await callView('0x1::primary_fungible_store::balance', ['0x1::aptos_coin::AptosCoin'], [address]);
      if (Array.isArray(result) && result[0] !== undefined) {
        const raw = parseInt(result[0]);
        console.log('[APT] view primary_fungible_store →', raw / 1e8);
        if (raw >= 0) return raw / 1e8;
      }
    } catch(e) {}

    console.warn('[APT] All methods failed');
    return 0;
  }

  /* Update sidebar balance display */
  async function refreshAllBalances(address) {
    const [apt, shby] = await Promise.all([
      fetchAptBalance(address),
      fetchShelbyUsdBalance(address)
    ]);

    console.log('[Balance] APT=' + apt.toFixed(4) + ', SHBY=' + shby.toFixed(4));

    const aptEl     = document.getElementById('sideAptBalance');
    const shbyEl    = document.getElementById('sideShbyBalance');
    const aptBadge  = document.getElementById('sideAptBadge');
    const shbyBadge = document.getElementById('sideShbyBadge');

    if (aptEl)     aptEl.textContent    = apt.toFixed(4);
    if (shbyEl)    shbyEl.textContent   = shby.toFixed(4);
    if (aptBadge)  aptBadge.textContent  = apt.toFixed(4) + ' APT';
    if (shbyBadge) shbyBadge.textContent = shby.toFixed(4) + ' SHBY';

    return { apt, shby };
  }
