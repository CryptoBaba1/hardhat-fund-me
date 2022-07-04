const { inputToConfig } = require("@ethereum-waffle/compiler")
const { assert, expect } = require("chai")
const { deployments, ethers, getNamedAccounts } = require("hardhat")

describe("FundMe", async function () {
    let fundMe
    let deployer
    let mockV3Aggregator
    let sendValue = ethers.utils.parseEther("1")
    beforeEach("deploy the contract", async function () {
        deployer = (await getNamedAccounts()).deployer
        await deployments.fixture(["all"])
        fundMe = await ethers.getContract("FundMe", deployer)
        mockV3Aggregator = await ethers.getContract(
            "MockV3Aggregator",
            deployer
        )
    })
    describe("constructor ", async function () {
        it("it should assign Aggegator correctly", async function () {
            const response = await fundMe.getPriceFeed()
            assert.equal(response, mockV3Aggregator.address)
        })
    })

    describe("fund", async function () {
        it("Fails if you dont send Enough Eth", async function () {
            await expect(fundMe.fund()).to.be.revertedWith(
                "You need to spend more ETH"
            )
        })
        it("update the amount funded data structure", async function () {
            await fundMe.fund({ value: sendValue })
            const response = await fundMe.getAddressToAmountFunded(deployer)
            assert.equal(sendValue.toString(), response.toString())
        })
        it("Adds funder to array of getFunder", async () => {
            await fundMe.fund({ value: sendValue })
            const response = await fundMe.getFunder(0)
            assert.equal(response, deployer)
        })
    })

    describe("withdraw", async function () {
        beforeEach(async function () {
            await fundMe.fund({ value: sendValue })
        })

        it("Withdraw ETH from a single founder", async function () {
            //Arrange
            const startingBalanceFundMe = await fundMe.provider.getBalance(
                fundMe.address
            )
            const staringdeployerBalance = await fundMe.provider.getBalance(
                deployer
            )
            //Act
            const transactionResponse = await fundMe.withdraw()
            const transactionReceipt = await transactionResponse.wait(1)
            const { gasUsed, effectiveGasPrice } = transactionReceipt
            const gascost = gasUsed.mul(effectiveGasPrice)
            const endingBalanceFundMe = await fundMe.provider.getBalance(
                fundMe.address
            )
            const endingdeployerBalance = await fundMe.provider.getBalance(
                deployer
            )
            //gascost

            //Assert
            assert.equal(endingBalanceFundMe.toString(), 0)
            assert.equal(
                startingBalanceFundMe.add(staringdeployerBalance).toString(),
                endingdeployerBalance.add(gascost).toString()
            )
        })

        it("is allows us to withdraw with multiple getFunder", async () => {
            //Arrange
            const accounts = await ethers.getSigners()
            for (i = 0; i < 6; i++) {
                const fundMeConnectedContract = await fundMe.connect(
                    accounts[i]
                )
                await fundMeConnectedContract.fund({ value: sendValue })
            }
            const startingBalanceFundMe = await fundMe.provider.getBalance(
                fundMe.address
            )
            const staringdeployerBalance = await fundMe.provider.getBalance(
                deployer
            )

            //Act
            const transactionResponse = await fundMe.withdraw()
            const transactionReceipt = await transactionResponse.wait(1)
            const { gasUsed, effectiveGasPrice } = transactionReceipt
            const gascost = gasUsed.mul(effectiveGasPrice)
            const endingBalanceFundMe = await fundMe.provider.getBalance(
                fundMe.address
            )
            const endingdeployerBalance = await fundMe.provider.getBalance(
                deployer
            )
            //Assert
            assert.equal(endingBalanceFundMe.toString(), 0)
            assert.equal(
                startingBalanceFundMe.add(staringdeployerBalance).toString(),
                endingdeployerBalance.add(gascost).toString()
            )

            //checking the getFunder are getting zero or not
            await expect(fundMe.getFunder(0)).to.be.reverted

            for (i = 1; i < 6; i++) {
                assert.equal(
                    await fundMe.getAddressToAmountFunded(accounts[i].address),
                    0
                )
            }
        })
        it("Only allows the deployer", async () => {
            const accounts = await ethers.getSigners()
            const attacker = accounts[1]
            const attackerConnectedContract = await fundMe.connect(attacker)
            await expect(
                attackerConnectedContract.withdraw()
            ).to.be.revertedWith("NotOwner")
        })
    })
})
