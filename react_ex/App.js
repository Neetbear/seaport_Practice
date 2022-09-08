import React, { useState } from "react";
import { ethers, BigNumber } from "ethers";
import "./App.css";
import { Button, Card } from "react-bootstrap";
import { Seaport } from "@opensea/seaport-js";
import { ItemType } from '@opensea/seaport-js/lib/constants';
// import { generateRandomSalt } from '@opensea/seaport-js/lib/utils/order';
// import { isCurrencyItem } from "@opensea/seaport-js/lib/utils/item";
  
function App() {
  const [data, setdata] = useState({
    address: "",
    Balance: null,
    provider: null,
    seaport: null
  });
  const [currentOrder, setorder] = useState(null);

  const provider = new ethers.providers.Web3Provider(window.ethereum);
  const seaport = new Seaport(provider);

  const btnhandler = () => {
    if (window.ethereum) {
      window.ethereum
        .request({ method: "eth_requestAccounts" })
        .then((res) => getbalance(res[0]));
    } else {
      alert("install metamask extension!!");
    }
    // console.log(provider)
  };

  const getbalance = (address) => {
    window.ethereum
      .request({ 
        method: "eth_getBalance", 
        params: [address, "latest"] 
      })
      .then((balance) => {
        setdata({
          address: address,
          Balance: ethers.utils.formatEther(balance),
          provider: new ethers.providers.Web3Provider(window.ethereum),
          seaport: new Seaport(provider)
        });
        console.log(seaport);
      });
  };

  const orderhandler = async () => {
    if (seaport != null) {
      const orderCreate = await seaport.createOrder(
        {
          // conduitKey: "0x0000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000",
          // zone: "0x00000000E88FE2628EbC5DA81d2b3CeaD633E89e",
          // zoneHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
          endTime:1664428149,
          offer: [{ 
            itemType: ItemType.ERC721,
            token: "0x51Bae864d00D543F2A40f2B6A623ABBea46AeA7e",
            identifier: "1",
            amount: "1",
            endAmount: "1"
          }],
          consideration: [{ 
            token: "0x0000000000000000000000000000000000000000",
            amount: ethers.utils.parseEther("0.01").toString(),
            endAmount: ethers.utils.parseEther("0.01").toString(),
            identifier: "0",
            recipient: data.address
          }],
          // allowPartialFills: false, 
          // restrictedByZone: true, 
          // fees:[{recipient: "0x0000a26b00c1F0DF003000390027140000fAa719", basisPoints: 250}],
        },
        data.address
      );

      const order = await orderCreate.executeAllActions();
      console.log("create order : ", order);
      setorder(order);
      // console.log(currentOrder);
    } else {
      alert("install metamask extension!!");
    }
  };

  const fulfillhandler = async () => {
    if (seaport != null & currentOrder != null) {
      const { executeAllActions: executeAllFulfillActions } = await seaport.fulfillOrder({
        order: currentOrder,
        accountAddress: data.address,
        // conduitKey: "0x0000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000"
      });

      const transaction = await executeAllFulfillActions();
      console.log("offer order : ", transaction);

      setorder(null);
    } else {
      alert("install metamask extension!!");
    }
  };

  const checkhandler = async () => {
    console.log(currentOrder);
  };
  
  return (
    <div className="App">
      {/* Calling all values which we 
       have stored in usestate */}
  
      <Card className="text-center">
        <Card.Header>
          <strong>Address: </strong>
          {data.address}
        </Card.Header>
        <Card.Body>
          <Card.Text>
            <strong>Balance: </strong>
            {data.Balance}
          </Card.Text>
          <Button onClick={btnhandler} variant="primary">
            Connect to wallet
          </Button>
          <Button onClick={orderhandler} variant="primary">
            Make order
          </Button>
          <Button onClick={fulfillhandler} variant="primary">
            fulfill order
          </Button>
          <Button onClick={checkhandler} variant="primary">
            check current order
          </Button>
        </Card.Body>
      </Card>
    </div>
  );
}
  
export default App;