import axios from 'axios'
import SockJS from 'sockjs-client'
import Stomp from '@stomp/stompjs'
import utils from '@/services/utils'

let socket = null
let stompClient = null

const tokenFromHash = function (state, ahash) {
  let myToken = null
  try {
    state.registry.applications.forEach((app) => {
      if (app.tokenContract && app.tokenContract.tokens) {
        const index = app.tokenContract.tokens.findIndex((o) => o.tokenInfo.assetHash === ahash)
        if (index > -1) {
          myToken = app.tokenContract.tokens[index]
        }
      }
    })
  } catch (err) {
    return myToken
  }
  return myToken
}

/**
export async function fetchAppGaiaHubUrl(username) {
  const response = await fetch(`https://core.blockstack.org/v1/users/${username}`);
  const zonefile = await response.json(); // the users zonefile

  const app = APP_URL; // the app you're looking for, eg 'http://localhost:3000'
  const zone_file = Object.values(zonefile)?.[0] as any;

  // account for both legacy use and the new format from the extension
  if (zone_file?.profile.apps || zone_file?.profile.appsMeta) {
    if (zone_file.profile?.appsMeta?.[app]) {
      return zone_file.profile?.appsMeta?.[app].storage;
    }
    if (zone_file.profile?.apps?.[app]) {
      return zone_file.profile?.apps?.[app];
    }
  }
  throw Error('Cannot find zonefile');
}
**/
const replaceTokenFromHash = function (state, token) {
  let result = false
  try {
    state.registry.applications.forEach((app) => {
      if (app.tokenContract && app.tokenContract.tokens) {
        const index = app.tokenContract.tokens.findIndex((o) => o.tokenInfo.assetHash === token.tokenInfo.assetHash)
        if (index > -1) {
          app.tokenContract.tokens[index] = token
          result = true
        } else {
          app.tokenContract.tokens.push(token)
          result = true
        }
      }
    })
  } catch (err) {
  }
  return result
}

const fetchAllGaiaData = function (commit, state, apiPath, data) {
  axios.post(apiPath, data).then(response => {
    const appDataMap = response.data
    if (appDataMap) {
      const keySet = Object.keys(appDataMap)
      keySet.forEach((thisKey) => {
        const rootFile = JSON.parse(appDataMap[thisKey])
        if (rootFile && rootFile.records && rootFile.records.length > -1) {
          rootFile.records.forEach((gaiaAsset) => {
            const token = tokenFromHash(state, gaiaAsset.assetHash)
            if (token) {
              // gaiaAsset = Object.assign(gaiaAsset, token)
              commit('addGaiaAsset', gaiaAsset)
            }
          })
        }
      })
    }
  })
}

/**
const fetchGaiaData = function (commit, state, data, apiPath) {
  const path = apiPath + '/mesh/v2/gaia/rootfile'
  const postData = {
    appOrigin: data.appOrigin,
    gaiaUsername: data.gaiaUsername
  }
  axios.post(path, postData).then(response => {
    const rootFile = response.data // JSON.parse(response.data)
    if (rootFile && rootFile.records && rootFile.records.length > -1) {
      rootFile.records.forEach((gaiaAsset) => {
        const token = tokenFromHash(state, gaiaAsset.assetHash)
        if (token) {
          // gaiaAsset = Object.assign(gaiaAsset, token)
          commit('addGaiaAsset', gaiaAsset)
        }
      })
    }
  })
}
**/

/**
const loadAssetsFromGaia = function (commit, state, apiPath) {
  if (state.registry && state.registry.applications) {
    state.registry.applications.forEach((app) => {
      if (app && app.tokenContract && app.tokenContract.tokens) {
        app.tokenContract.tokens.forEach((token) => {
          fetchGaiaData(commit, state, { appOrigin: app.appOrigin, gaiaFilename: app.gaiaFilename, gaiaUsername: token.tokenInfo.gaiaUsername, assetHash: token.tokenInfo.assetHash }, apiPath)
        })
      }
    })
  }
}
**/
const loadAssetsFromGaia = function (commit, state, registry, connectUrl, contractId) {
  let path = connectUrl + '/v2/gaia/rootFiles'
  if (registry.applications && contractId) {
    const index = registry.applications.findIndex((o) => o.contractId === contractId)
    if (index > -1) {
      const application = registry.applications[index]
      path = connectUrl + '/v2/gaia/rootFilesByDomain'
      const data = {
        appOrigin: application.appOrigin
      }
      fetchAllGaiaData(commit, state, path, data)
    }
  } else {
    fetchAllGaiaData(commit, state, path)
  }
}

const subscribeApiNews = function (state, commit, connectUrl, gaiaAppDomains, contractId) {
  if (!socket) socket = new SockJS(connectUrl + '/api-news')
  if (!stompClient) stompClient = Stomp.over(socket)
  socket.onclose = function () {
    console.log('close')
    stompClient.disconnect()
  }
  stompClient.connect({}, function () {
    if (!contractId) {
      stompClient.subscribe('/queue/contract-news', function (response) {
        const registry = JSON.parse(response.body)
        commit('setRegistry', registry)
        loadAssetsFromGaia(commit, state, registry, connectUrl, contractId)
      })
    } else {
      stompClient.subscribe('/queue/contract-news-' + contractId, function (response) {
        const registry = JSON.parse(response.body)
        commit('setRegistry', registry)
        loadAssetsFromGaia(commit, state, registry, connectUrl, contractId)
      })
    }
  },
  function (error) {
    console.log(error)
  })
}

const resolvePrincipals = function (registry) {
  if (!registry || !registry.administrator) return
  registry.administrator = utils.convertAddress(registry.administrator)
  if (registry.applications) {
    registry.applications.forEach((app) => {
      app.owner = utils.convertAddress(app.owner)
      if (app.tokenContract) {
        app.tokenContract.administrator = utils.convertAddress(app.tokenContract.administrator)
        app.tokenContract.tokens.forEach((token) => {
          token.owner = utils.convertAddress(token.owner)
          if (token.offerHistory) {
            token.offerHistory.forEach((offer) => {
              offer.offerer = utils.convertAddress(offer.offerer)
            })
          }
          if (token.bidHistory) {
            token.bidHistory.forEach((bid) => {
              bid.bidder = utils.convertAddress(bid.bidder)
            })
          }
        })
      }
    })
  }
  return registry
}

const unsubscribeApiNews = function () {
  if (socket && stompClient) {
    stompClient.disconnect()
  }
}

const convertToTradeInfo = function (asset) {
  const saleData = {
    saleType: 0,
    buyNowOrStartingPrice: 0,
    reservePrice: 0,
    biddingEndTime: 0,
    incrementPrice: 0
  }
  if (asset && asset.saleData) {
    saleData.saleType = asset.saleData['sale-type'].value
    saleData.buyNowOrStartingPrice = asset.saleData['amount-stx'].value
    saleData.reservePrice = asset.saleData['reserve-stx'].value
    saleData.biddingEndTime = asset.saleData['bidding-end-time'].value
    saleData.incrementPrice = asset.saleData['increment-stx'].value
  }
  return saleData
}

const rpayStacksContractStore = {
  namespaced: true,
  state: {
    registry: null,
    registryContractId: process.env.VUE_APP_REGISTRY_CONTRACT_ADDRESS + '.' + process.env.VUE_APP_REGISTRY_CONTRACT_NAME,
    gaiaAssets: []
  },
  getters: {
    getRegistry: state => {
      return state.registry
    },
    getRegistryContractId: state => {
      return state.registryContractId
    },
    getApplicationFromRegistryByContractId: state => contractId => {
      if (!state.registry || !state.registry.applications) return
      const index = state.registry.applications.findIndex((o) => o.contractId === contractId)
      if (index < 0) return null
      return state.registry.applications[index]
    },
    getTradeInfoFromHash: state => ahash => {
      const asset = tokenFromHash(state, ahash)
      return convertToTradeInfo(asset)
    },
    getAssetFromContractByHash: state => assetHash => {
      return tokenFromHash(state, assetHash)
    },
    getGaiaAssetByHash: state => assetHash => {
      const index = state.gaiaAssets.findIndex((o) => o.assetHash === assetHash)
      if (index > -1) {
        return state.gaiaAssets[index]
      }
      return null
    },
    getAssetsByContractId: state => contractId => {
      if (!state.registry || !state.registry.applications) return
      const index = state.registry.applications.findIndex((o) => o.contractId === contractId)
      if (index < 0) return []
      return state.registry.applications[index].tokenContract.tokens
    },
    getAssetsByContractIdAndOwner: state => data => {
      if (!state.registry || !state.registry.applications) return
      const index = state.registry.applications.findIndex((o) => o.contractId === data.contractId)
      if (index < 0) return []
      const tokens = state.registry.applications[index].tokenContract.tokens
      return tokens.filter((o) => o.gaiaUsername === data.username)
    },
    getGaiaAssets: state => {
      return state.gaiaAssets
    },
    getGaiaAssetsByOwner: state => data => {
      if (!state.gaiaAssets) return
      return state.gaiaAssets.filter((o) => o.owner === data.username)
    }
  },
  mutations: {
    setRegistry (state, registry) {
      registry = resolvePrincipals(registry)
      state.registry = registry
    },
    setToken (state, token) {
      replaceTokenFromHash(state, token)
    },
    addGaiaAsset (state, gaiaAsset) {
      if (!state.gaiaAssets) return
      const index = state.gaiaAssets.findIndex((o) => o.assetHash === gaiaAsset.assetHash)
      if (index === -1) {
        state.gaiaAssets.splice(0, 0, gaiaAsset)
      } else {
        state.gaiaAssets.splice(index, 1, gaiaAsset)
      }
    },
    addContractWriteResult (state, asset) {
      if (!state.gaiaAssets) return
      const index = state.gaiaAssets.findIndex((o) => o.assetHash === asset.assetHash)
      if (index === -1) {
        state.gaiaAssets.splice(0, 0, asset)
      } else {
        state.gaiaAssets.splice(index, 1, asset)
      }
    }
  },
  actions: {
    cleanup ({ state, commit, rootGetters }) {
      return new Promise((resolve, reject) => {
        unsubscribeApiNews()
        resolve(null)
      })
    },
    fetchContractData ({ state, commit, rootGetters }) {
      return new Promise((resolve, reject) => {
        const configuration = rootGetters['rpayStore/getConfiguration']
        // if project id is set in config then read search index of this
        // project. Otherwise search projects recursively
        let path = configuration.risidioBaseApi + '/mesh/v2/registry'
        if (configuration.risidioProjectId) {
          path = configuration.risidioBaseApi + '/mesh/v2/registry/' + configuration.risidioProjectId
        }
        axios.get(path).then(response => {
          loadAssetsFromGaia(commit, state, response.data, configuration.risidioBaseApi + '/mesh', configuration.risidioProjectId)
          subscribeApiNews(state, commit, configuration.risidioBaseApi + '/mesh', configuration.gaiaAppDomains, configuration.risidioProjectId)
          commit('setRegistry', response.data)
          resolve(response.data)
        }).catch((error) => {
          reject(error)
        })
      })
    }
  }
}
export default rpayStacksContractStore
