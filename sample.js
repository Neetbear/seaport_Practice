const { Seaport } = require("@opensea/seaport-js");
const { ItemType } = require("@opensea/seaport-js/lib/constants");
const { balanceOf } = require("@opensea/seaport-js/lib/utils/balance");
const { generateRandomSalt, mapOrderAmountsFromFilledStatus, mapOrderAmountsFromUnitsToFill } = require("@opensea/seaport-js/lib/utils/order");
const { isCurrencyItem, getPresentItemAmount } = require("@opensea/seaport-js/lib/utils/item");
const { ethers, BigNumber } = require("ethers");

const getBalancesForFulfillOrder = async (
    order,
    fulfillerAddress,
    multicallProvider
  ) => {
    const { offer, consideration, offerer } = order.parameters;
  
    const relevantAddresses = Array.from(
      new Set([
        offerer,
        fulfillerAddress,
        ...consideration.map((item) => item.recipient),
      ])
    );
  
    const ownerToTokenToIdentifierBalances = {};
  
    relevantAddresses.forEach((address) => {
      ownerToTokenToIdentifierBalances[address] = {};
    });
  
    // Just prepopulate all the keys so we can do an async map
    for (const item of [...offer, ...consideration]) {
      for (const address of relevantAddresses) {
        ownerToTokenToIdentifierBalances[address] = {
          ...ownerToTokenToIdentifierBalances[address],
          [item.token]: {
            [item.identifierOrCriteria]: {
              item,
              balance: BigNumber.from(0),
            },
          },
        };
      }
    }
  
    await Promise.all(
      [...offer, ...consideration].map((item) =>
        Promise.all([
          ...relevantAddresses.map(async (address) => {
            ownerToTokenToIdentifierBalances[address][item.token][
              item.identifierOrCriteria
            ] = {
              item,
              balance: await balanceOf(address, item, multicallProvider),
            };
          }),
        ])
      )
    );
  
    return ownerToTokenToIdentifierBalances;
};
  
const constructPrivateListingCounterOrder = (
    order,
    privateSaleRecipient
  ) => {
    // Counter order offers up all the items in the private listing consideration
    // besides the items that are going to the private listing recipient
    const paymentItems = order.parameters.consideration.filter(
      (item) =>
        item.recipient.toLowerCase() !== privateSaleRecipient.toLowerCase()
    );
  
    if (!paymentItems.every((item) => isCurrencyItem(item))) {
      throw new Error(
        "The consideration for the private listing did not contain only currency items"
      );
    }
    if (
      !paymentItems.every((item) => item.itemType === paymentItems[0].itemType)
    ) {
      throw new Error("Not all currency items were the same for private order");
    }
  
    const { aggregatedStartAmount, aggregatedEndAmount } = paymentItems.reduce(
      ({ aggregatedStartAmount, aggregatedEndAmount }, item) => ({
        aggregatedStartAmount: aggregatedStartAmount.add(item.startAmount),
        aggregatedEndAmount: aggregatedEndAmount.add(item.endAmount),
      }),
      {
        aggregatedStartAmount: BigNumber.from(0),
        aggregatedEndAmount: BigNumber.from(0),
      }
    );
  
    const counterOrder = {
      parameters: {
        ...order.parameters,
        offerer: privateSaleRecipient,
        offer: [
          {
            itemType: paymentItems[0].itemType,
            token: paymentItems[0].token,
            identifierOrCriteria: paymentItems[0].identifierOrCriteria,
            startAmount: aggregatedStartAmount.toString(),
            endAmount: aggregatedEndAmount.toString(),
          },
        ],
        // The consideration here is empty as the original private listing order supplies
        // the taker address to receive the desired items.
        consideration: [],
        salt: generateRandomSalt(),
        totalOriginalConsiderationItems: 0,
      },
      signature: "0x",
    };
  
    return counterOrder;
};

const getPrivateListingFulfillments = (
    privateListingOrder
  ) => {
    const nftRelatedFulfillments = [];
  
    // For the original order, we need to match everything offered with every consideration item
    // on the original order that's set to go to the private listing recipient
    privateListingOrder.parameters.offer.forEach((offerItem, offerIndex) => {
      const considerationIndex =
        privateListingOrder.parameters.consideration.findIndex(
          (considerationItem) =>
            considerationItem.itemType === offerItem.itemType &&
            considerationItem.token === offerItem.token &&
            considerationItem.identifierOrCriteria ===
              offerItem.identifierOrCriteria
        );
      if (considerationIndex === -1) {
        throw new Error(
          "Could not find matching offer item in the consideration for private listing"
        );
      }
      nftRelatedFulfillments.push({
        offerComponents: [
          {
            orderIndex: 0,
            itemIndex: offerIndex,
          },
        ],
        considerationComponents: [
          {
            orderIndex: 0,
            itemIndex: considerationIndex,
          },
        ],
      });
    });
  
    const currencyRelatedFulfillments = [];
  
    // For the original order, we need to match everything offered with every consideration item
    // on the original order that's set to go to the private listing recipient
    privateListingOrder.parameters.consideration.forEach(
      (considerationItem, considerationIndex) => {
        if (!isCurrencyItem(considerationItem)) {
          return;
        }
        // We always match the offer item (index 0) of the counter order (index 1)
        // with all of the payment items on the private listing
        currencyRelatedFulfillments.push({
          offerComponents: [
            {
              orderIndex: 1,
              itemIndex: 0,
            },
          ],
          considerationComponents: [
            {
              orderIndex: 0,
              itemIndex: considerationIndex,
            },
          ],
        });
      }
    );
  
    return [...nftRelatedFulfillments, ...currencyRelatedFulfillments];
};

const verifyBalancesAfterFulfill = async ({
    ownerToTokenToIdentifierBalances,
    order,
    unitsToFill,
    orderStatus,
    fulfillReceipt,
    fulfillerAddress,
    multicallProvider,
    timeBasedItemParams,
  }) => {
    const totalFilled = orderStatus?.totalFilled ?? BigNumber.from(0);
    const totalSize = orderStatus?.totalSize ?? BigNumber.from(0);
  
    const orderWithAdjustedFills = unitsToFill
      ? mapOrderAmountsFromUnitsToFill(order, {
          unitsToFill,
          totalFilled,
          totalSize,
        })
      : mapOrderAmountsFromFilledStatus(order, {
          totalFilled,
          totalSize,
        });
  
    const { offer, consideration, offerer } = orderWithAdjustedFills.parameters;
  
    // Offer items are depleted
    offer.forEach((item) => {
      const exchangedAmount = getPresentItemAmount({
        startAmount: item.startAmount,
        endAmount: item.endAmount,
        timeBasedItemParams: timeBasedItemParams
          ? { ...timeBasedItemParams, isConsiderationItem: false }
          : undefined,
      });
  
      ownerToTokenToIdentifierBalances[offerer][item.token][
        item.identifierOrCriteria
      ] = {
        item,
        balance:
          ownerToTokenToIdentifierBalances[offerer][item.token][
            item.identifierOrCriteria
          ].balance.sub(exchangedAmount),
      };
  
      ownerToTokenToIdentifierBalances[fulfillerAddress][item.token][
        item.identifierOrCriteria
      ] = {
        item,
        balance:
          ownerToTokenToIdentifierBalances[fulfillerAddress][item.token][
            item.identifierOrCriteria
          ].balance.add(exchangedAmount),
      };
    });
  
    consideration.forEach((item) => {
      const exchangedAmount = getPresentItemAmount({
        startAmount: item.startAmount,
        endAmount: item.endAmount,
        timeBasedItemParams: timeBasedItemParams
          ? { ...timeBasedItemParams, isConsiderationItem: true }
          : undefined,
      });
  
      ownerToTokenToIdentifierBalances[fulfillerAddress][item.token][
        item.identifierOrCriteria
      ] = {
        item,
        balance:
          ownerToTokenToIdentifierBalances[fulfillerAddress][item.token][
            item.identifierOrCriteria
          ].balance.sub(exchangedAmount),
      };
  
      ownerToTokenToIdentifierBalances[item.recipient][item.token][
        item.identifierOrCriteria
      ] = {
        item,
        balance:
          ownerToTokenToIdentifierBalances[item.recipient][item.token][
            item.identifierOrCriteria
          ].balance.add(exchangedAmount),
      };
    });
  
    // Take into account gas costs
    if (
      ownerToTokenToIdentifierBalances[fulfillerAddress][
        ethers.constants.AddressZero
      ]
    ) {
      ownerToTokenToIdentifierBalances[fulfillerAddress][
        ethers.constants.AddressZero
      ][0] = {
        ...ownerToTokenToIdentifierBalances[fulfillerAddress][
          ethers.constants.AddressZero
        ][0],
        balance: ownerToTokenToIdentifierBalances[fulfillerAddress][
          ethers.constants.AddressZero
        ][0].balance.sub(
          fulfillReceipt.gasUsed.mul(fulfillReceipt.effectiveGasPrice)
        ),
      };
    }
  
    await Promise.all([
      ...Object.entries(ownerToTokenToIdentifierBalances).map(
        ([owner, tokenToIdentifierBalances]) =>
          Promise.all([
            ...Object.values(tokenToIdentifierBalances).map(
              (identifierToBalance) =>
                Promise.all([
                  ...Object.values(identifierToBalance).map(
                    async ({ balance, item }) => {
                      const actualBalance = await balanceOf(
                        owner,
                        item,
                        multicallProvider
                      );
  
                      expect(balance).equal(actualBalance);
                    }
                  ),
                ])
            ),
          ])
      ),
    ]);
};