// import { Seaport } from "@opensea/seaport-js";
// import { ethers } from "ethers";
// import { ItemType } from "@opensea/seaport-js/lib/constants";
// import dotenv from "dotenv";
// dotenv.config();
const { Seaport } = require("@opensea/seaport-js");
const { ItemType } = require("@opensea/seaport-js/lib/constants");
const { ethers } = require("ethers");
require('dotenv').config();

const { GOERLI_KEY, ACCOUNT_PRIVATE_KEY1, ACCOUNT_PRIVATE_KEY2 } = process.env;

// Provider must be provided to the signer when supplying a custom signer
const provider = new ethers.providers.JsonRpcProvider(
    `https://eth-goerli.g.alchemy.com/v2/${GOERLI_KEY}`
);

const signer1 = new ethers.Wallet(`${ACCOUNT_PRIVATE_KEY1}`, provider);
const signer2 = new ethers.Wallet(`${ACCOUNT_PRIVATE_KEY2}`, provider);

const seaport1 = new Seaport(signer1);
const seaport2 = new Seaport(signer2);

// db 필요 부분 총 3개 예상 
// 1. createOrder 후 order fulfillOrder 전까지 order 정보 
// 2. 거래가에 대한 영역 및 list 관련
// 3. 수수료나 창작자의 2차 거래 수익등 관련 
// 입력받을 값 마감 시간, offer 정보, consideration 정보 (수수료 현재까진 미사용 예정)
const offerOrder = async () =>{
    const fulfiller = "0x55C5aEaB5D6676aeEA374A48246393a63eaab7aE"; // seaport1
    const offerer = "0x191a0b6268C7aeaaE8C2e35Ff01199875ef49104";   // seaport2

    const orderCreate = await seaport2.createOrder(
        {
            conduitKey: "0x0000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000",
            // zone: "0x0000000000000000000000000000000000000000", 사용시에만 입력
            // zoneHash: "0x0000000000000000000000000000000000000000000000000000000000000000", 사용시에만 입력
            // startTime: Date.now(), 생략하면 알아서 blocktime 들어가니 왠만하면 생략할 것 
            endTime:1664428149, // 현재시간부터 마감시간까지 timestamp 계산해서 넣기
            offer: [{ // offer 정보 item type, address, id, amount(, endamount 생략가능)
                itemType: ItemType.ERC721,
                token: "0xfE73f8eD3570a9a6b659dD579f498F67150e1597",
                identifier: "1",
                amount: "1"
            }],
            consideration: [{ // offer 정보 item type(ether 시 생략가능), address, id, amount(, endamount 생략가능), recipient 수령인
                token: "0x0000000000000000000000000000000000000000",
                amount: ethers.utils.parseEther("0.01").toString(),
                identifier: "0",
                recipient: offerer
            }],
            // counter: 0, seaport가 알아서 찾아주니 생략해도 된다
            allowPartialFills: false, // 부분거래 허용시에만 true
            restrictedByZone: false, // zone 사용시에만 true 줄 수 있다
            fees:[{recipient: "0x0000a26b00c1F0DF003000390027140000fAa719", basisPoints: 250}],
        },
        offerer
    );

    const order = await orderCreate.executeAllActions(); // 구조상 db에 저장 해야된다
    console.log("create order : ", order);

    // 거래 취소
    // 취소된 거래 fulfill 시도시 Warning! Error encountered during contract execution [execution reverted]로 취소된다 
    //      -> etherscan으로 확인 가능
    // const orderCancel = await seaport2.cancelOrders([order.parameters], offerer).transact();
    // console.log("cancel order : ", orderCancel);

    // const orderhash = seaport2.getOrderHash(order.parameters);
    // console.log("order hash : ", orderhash);

    // const orderStatus = await seaport2.getOrderStatus(orderhash);
    // console.log("order status : ", orderStatus);

    // const counterNum = await seaport2.getCounter(offerer);
    // console.log("counter : ", counterNum);

    const { executeAllActions: executeAllFulfillActions } = await seaport1.fulfillOrder({
        order, // 구조상 db에서 찾아와야 한다
        accountAddress: fulfiller,
        conduitKey: "0x0000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000"
    });

    const transaction = await executeAllFulfillActions();
    console.log("offer order : ", transaction);
} 
offerOrder();

// 1155 경우
const offer1155 = async () =>{
    const offerer = "0x55C5aEaB5D6676aeEA374A48246393a63eaab7aE"; // seaport1
    const fulfiller = "0x191a0b6268C7aeaaE8C2e35Ff01199875ef49104"; // seaport2

    const orderCreate = await seaport1.createOrder(
        {
            conduitKey: "0x0000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000",
            zone: "0x00000000E88FE2628EbC5DA81d2b3CeaD633E89e",
            zoneHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
            // startTime:Date.now(),
            endTime:1664428149,
            offer: [{
                itemType: ItemType.ERC1155,
                token: "0x001ebb9bD304777cEa755e6CBcc7438F5bF7d91e",
                identifier: "0",
                amount: "2",
                endAmount: "2"
            }],
            consideration: [{
                token: "0x0000000000000000000000000000000000000000",
                amount: ethers.utils.parseEther("0.01").toString(),
                identifier: "0",
                recipient: offerer
            }],
            // counter: 0,
            allowPartialFills: false,
            restrictedByZone: true,
            fees:[{recipient: "0x0000a26b00c1F0DF003000390027140000fAa719", basisPoints: 250}],
        },
        offerer
    );

    const order = await orderCreate.executeAllActions();
    console.log("create order : ", order);

    // const orderCancel = await seaport1.cancelOrders([order.parameters], offerer).transact();
    // console.log("cancel order : ", orderCancel);

    // const orderhash = seaport1.getOrderHash(order.parameters);
    // console.log("order hash : ", orderhash);

    // const orderStatus = await seaport1.getOrderStatus(orderhash);
    // console.log("order status : ", orderStatus);

    // const counterNum = await seaport1.getCounter(offerer);
    // console.log("counter : ", counterNum);

    const { executeAllActions: executeAllFulfillActions } =
    await seaport2.fulfillOrder({
        order,
        accountAddress: fulfiller.address,
        conduitKey: "0x0000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000"
    });

    const transaction = await executeAllFulfillActions();
    console.log("offer order : ", transaction);
} 
// offer1155();