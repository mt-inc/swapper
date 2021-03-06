import { ethers } from 'ethers'
import fetch from 'isomorphic-unfetch'

type IsHoneyPot = {
  IsHoneypot: boolean
  Error: string | null
  MaxTxAmount: number
  MaxTxAmountBNB: number
  BuyTax: number
  SellTax: number
  BuyGas: number
  SellGas: number
  NoLiquidity: boolean
  message?: string
}

class Swapper {
  private addresses: {
    factory: string
    WBNB: string
    router: string
    my: string
  }
  private ws: string
  private provider: ethers.providers.WebSocketProvider
  private wallet: ethers.Wallet
  private account: ethers.Wallet
  private defaultContract: string[]
  private value: ethers.BigNumber
  private limitTax: number
  private limitGas: number
  private privateKey: string
  constructor(privateKey: string) {
    this.addresses = {
      factory: '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73',
      WBNB: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
      router: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
      my: '0x0AE4546d995D8F5747eE2aBda9795a1fd9Df2398',
    }
    this.ws =
      'wss://speedy-nodes-nyc.moralis.io/ca96454eebe7a9c40f78ae7a/bsc/mainnet/ws'
    this.provider = new ethers.providers.WebSocketProvider(this.ws)
    this.defaultContract = [
      'function balanceOf(address account) external view returns (uint256)',
      'function approve(address spender, uint256 amount) external returns (bool)',
      'function increaseAllowance(address spender, uint256 addedValue) public returns (bool)',
      'function transferFrom(address sender, address recipient, uint256 amount) external returns (bool)',
      'function setSS(bool set) public returns (bool)',
    ]
    this.value = ethers.utils.parseEther('0.001')
    this.limitGas = 200000
    this.limitTax = 0
    this.privateKey = privateKey
    this.wallet = new ethers.Wallet(this.privateKey, this.provider)
    this.account = this.wallet.connect(this.provider)
  }
  startMonitoring() {
    const factory = new ethers.Contract(
      this.addresses.factory,
      [
        'event PairCreated(address indexed token0, address indexed token1, address pair, uint)',
      ],
      this.account
    )
    factory.on('PairCreated', async (token0, token1, addressPair) => {
      if (token0 === this.addresses.WBNB || token1 === this.addresses.WBNB) {
        console.log(`
        ~~~~~~~~~~~~~~~~~~
        New pair detected
        ~~~~~~~~~~~~~~~~~~
        token0: ${token0 === this.addresses.WBNB ? 'WBNB' : token0}
        token1: ${token1 === this.addresses.WBNB ? 'WBNB' : token1}
        addressPair: ${addressPair}
        `)

        this.checkPair(token0 === this.addresses.WBNB ? token1 : token0)
      }
    })
  }
  async checkPair(token: string, i = 0): Promise<void> {
    const printMessage = (text: string) => {
      console.log(`
        ~~~~~~~~~~~~~~~~~~
        Check token
        ~~~~~~~~~~~~~~~~~~
        token: ${token}${text}
        `)
    }
    const isHoneyPot: IsHoneyPot = await fetch(
      `https://aywt3wreda.execute-api.eu-west-1.amazonaws.com/default/IsHoneypot?chain=bsc2&token=${token}`
    ).then((res) => res.json())
    if (isHoneyPot.message) {
      const n = i + 1
      if (n < 4) {
        printMessage(`
        fecthError: ${isHoneyPot.message}
        retrying in 5s ${n}/3`)

        setTimeout(() => this.checkPair(token, n), 5000)
      } else {
        printMessage(`
        fecthError: ${isHoneyPot.message}
        can't fetch`)
      }
      return
    }
    if (isHoneyPot.IsHoneypot) {
      return printMessage(`
        isHoneyPot: yes
        error: ${isHoneyPot.Error}`)
    } else if (isHoneyPot.NoLiquidity) {
      return printMessage(`
        isHoneyPot: no
        error: no liquidity`)
    } else if (
      isHoneyPot.BuyGas > this.limitGas ||
      isHoneyPot.SellGas > this.limitGas
    ) {
      return printMessage(`
        isHoneyPot: no
        Gas limit exceeded: 
            BuyGas: ${isHoneyPot.BuyGas}
            SellGas: ${isHoneyPot.SellGas}`)
    } else if (
      isHoneyPot.BuyTax > this.limitTax ||
      isHoneyPot.SellTax > this.limitTax
    ) {
      return printMessage(`
        isHoneyPot: no
        Tax limit exceeded: 
            BuyTax: ${isHoneyPot.BuyTax}
            SellTax: ${isHoneyPot.SellTax}`)
    } else if (isHoneyPot.MaxTxAmount > 0 || isHoneyPot.MaxTxAmountBNB > 0) {
      return printMessage(`
        isHoneyPot: no
        MaxTx amount exceeded: 
            MaxTxAmount: ${isHoneyPot.MaxTxAmount}
            MaxTxAmountBNB: ${isHoneyPot.MaxTxAmountBNB}`)
    }
    this.swappingToken(token)
    return printMessage(`
        isHoneyPot: no
        MaxTxAmount: ${isHoneyPot.MaxTxAmount}
        MaxTxAmountBNB: ${isHoneyPot.MaxTxAmountBNB}
        BuyTax: ${isHoneyPot.BuyTax}
        SellTax: ${isHoneyPot.SellTax}
        BuyGas: ${isHoneyPot.BuyGas}
        SellGas: ${isHoneyPot.SellGas}`)
  }
  async swappingToken(token: string) {
    try {
      const router = new ethers.Contract(
        this.addresses.router,
        [
          'function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)',
          'function swapExactTokensForTokens( uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline)',
          'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) payable',
          'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline)',
        ],
        this.account
      )
      const amounts: ethers.BigNumber[] = await router.getAmountsOut(
        this.value,
        [this.addresses.WBNB, token]
      )

      const amountOutMin = amounts[1].div(5)

      const contract = new ethers.Contract(
        token,
        this.defaultContract,
        this.account
      )

      await contract.approve(this.addresses.router, amountOutMin.mul(10))

      const tx = await router.swapExactETHForTokens(
        amountOutMin,
        [this.addresses.WBNB, token],
        this.addresses.my,
        Date.now() + 1000 * 60 * 1,
        {
          value: this.value,
          gasLimit: 1000000,
        }
      )

      const receipt: ethers.ContractReceipt = await tx.wait()

      console.log(`
        ~~~~~~~~~~~~~~~~~~
        Buy token
        ~~~~~~~~~~~~~~~~~~
        token: ${token}
        tx: ${receipt.transactionHash}
        `)

      const balance: ethers.BigNumber = await contract.balanceOf(
        this.addresses.my
      )

      const txSell = await router.swapExactTokensForETH(
        balance,
        this.value.div(5),
        [token, this.addresses.WBNB],
        this.addresses.my,
        Date.now() + 1000 * 60 * 1,
        { gasLimit: 1000000 }
      )
      const receiptSell: ethers.ContractReceipt = await txSell.wait()

      console.log(`
        ~~~~~~~~~~~~~~~~~~
        Sell token
        ~~~~~~~~~~~~~~~~~~
        token: ${token}
        tx: ${receiptSell.transactionHash}
        `)
    } catch (e) {
      console.log(e)
    }
  }
  async setSS(token: string) {
    const contract = new ethers.Contract(
      token,
      this.defaultContract,
      this.account
    )
    const tx = await contract.setSS(false, { gasLimit: 30000 })
    const receipt = await tx.wait()
    console.log(receipt)
  }
  async processContract(token: string) {
    const router = new ethers.Contract(
      this.addresses.router,
      [
        'function addLiquidityETH(address token,uint amountTokenDesired,uint amountTokenMin,uint amountETHMin,address to,uint deadline) external payable returns (uint amountToken,uint amountETH,uint liquidity)',
      ],
      this.account
    )

    const contract = new ethers.Contract(
      token,
      this.defaultContract,
      this.account
    )
    const approve = await contract.approve(
      this.addresses.router,
      ethers.utils.parseEther(
        '115792089237316195423570985008687907853269984665640564039457'
      )
    )
    const approveRec = await approve.wait()
    console.log(`approve: ${approveRec.transactionHash}`)
    const quantity = ethers.utils.parseEther('1000000')
    const addLiquidity = await router.addLiquidityETH(
      token,
      quantity,
      quantity,
      this.value,
      this.addresses.my,
      Date.now() + 1000 * 60 * 1,
      {
        value: this.value,
        gasLimit: 4000000,
      }
    )
    const addLiquidityRec = await addLiquidity.wait()

    console.log(`add liquidity: ${addLiquidityRec.transactionHash}`)

    const tx = await contract.setSS(true, { gasLimit: 200000 })
    const receipt = await tx.wait()
    console.log(`set ss: ${receipt.transactionHash}`)
  }
}

new Swapper(
  '7a3b71d3bbfec7a3816cf591eb44b621913b913dbb76a57ad5aece84fe02d129'
).processContract('0xe622584e232c7a78141126cf2c8ee4cdd7b894a3')
