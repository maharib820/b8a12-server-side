const express = require('express')
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express()
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());



// -------------------------------------------------------------------------------------------------------------------------------------------------------------
// -------------------------------------------------------------------------------------------------------------------------------------------------------------
// -------------------------------------------------------------------------------------------------------------------------------------------------------------


const uri = `mongodb+srv://${process.env.SURVEY_DB_USER}:${process.env.SURVEY_DB_PASS}@cluster0.8ydx2m5.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: false,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();


        // code start

        // collections
        const usersCollection = client.db("opinion").collection("users");
        const surveysCollection = client.db("opinion").collection("surveys");
        const paymentsCollection = client.db("opinion").collection("payments");
        const attendSurveyCollection = client.db("opinion").collection("attendsurvey");

        // api related task

        // add new user
        app.post("/user", async (req, res) => {
            const newUser = req.body;
            // console.log(newUser);
            const query = { email: newUser.email };
            const existingUser = await usersCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: "user already exists", insertedId: null });
            }
            const result = await usersCollection.insertOne(newUser);
            res.send(result);
        })

        // get/fetch all registered users
        app.get("/users", async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result);
        })

        // update user role
        app.patch("/user/:id", async (req, res) => {
            const id = req.params.id;
            const data = req.body;
            console.log(data);
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: data.userRole
                },
            };
            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result);
        })

        // delete an user by admin
        app.delete("/user/:id", async (req, res) => {
            const id = req.params.id;
            // console.log(id);
            const totalAdmin = await usersCollection.countDocuments({ role: "admin" });
            // console.log(totalAdmin);
            const filter = { _id: new ObjectId(id) };
            const isAdmin = await usersCollection.findOne(filter);
            console.log(isAdmin);
            if (totalAdmin <= 1 && isAdmin.role === "admin") {
                return res.send({ message: "admin number can not be zero" });
            }
            const result = await usersCollection.deleteOne(filter);
            res.send(result);
        })

        // show or display users using filter value
        app.get("/users/:role", async (req, res) => {
            const role = req.params.role;
            const filter = { role: role };
            const result = await usersCollection.find(filter).toArray();
            res.send(result);
        })

        // //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        // check role
        app.get("/user/role/:email", async (req, res) => {
            const email = req.params.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            const role = { role: user?.role }
            res.send(role)
        })

        // //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        // send new created survey data to database
        app.post("/createsurvey", async (req, res) => {
            const modifiedData = {
                title : req.body.title,
                description : req.body.description,
                question : req.body.question,
                category : req.body.category,
                addedby : req.body.addedby,
                addedName : req.body.addedName,
                surveyorImage : req.body.surveyorImage,
                status : req.body.status,
                addedDate : new Date(),
                expDate : new Date(req.body.expDate),
                yes : req.body.yes,
                no : req.body.no,
                like : req.body.like,
                dislike : req.body.dislike,
                total : req.body.total,
                comments : req.body.comments,
                reports : req.body.reports
            }
            const result = await surveysCollection.insertOne(modifiedData);
            res.send(result);
        })

        // show all added surveys by specific surveyor
        app.get("/myaddedsurveys/:email", async (req, res) => {
            const email = req.params.email;
            const filter = { addedby: email };
            const result = await surveysCollection.find(filter).toArray();
            res.send(result)
        })

        // show all survey in the admin panel
        app.get("/allsurveys", async (req, res) => {
            const result = await surveysCollection.find().toArray();
            res.send(result)
        })

        // update status by admin
        app.patch("/updatestatus/:id", async (req, res) => {
            const id = req.params.id;
            const changes = req.body;
            const feedback = changes.feedback;
            const status = changes.status;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    status: status,
                    feedback: feedback
                },
            };
            const result = await surveysCollection.updateOne(filter, updateDoc);
            res.send(result);
        })

        // show published surveys
        app.get("/publishedsurveys", async (req, res) => {
            const filter = { status: "publish" }
            const result = await surveysCollection.find(filter).toArray();
            res.send(result);
        })

        // fetch single survey details from database
        app.get("/surveydetails/:id", async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const result = await surveysCollection.find(filter).toArray();
            res.send(result);
        })

        // stripe
        app.post("/create-payment-intent", async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100);

            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });
            // console.log('secret is', paymentIntent.client_secret);
            res.send({
                clientSecret: paymentIntent.client_secret
            })
        })


        // after payment get history and change status
        app.post("/payments/:email", async (req, res) => {
            const payment = req.body;
            const email = req.params.email;
            const paymentResult = await paymentsCollection.insertOne(payment);
            const filter = { email: email };
            // change status
            const updateDoc = {
                $set: {
                    role: "pro user"
                },
            };
            const updateResult = await usersCollection.updateOne(filter, updateDoc)
            res.send({ paymentResult, updateResult });
        })


        // big modification after survey done
        app.patch("/surveyaftervote/:id", async(req, res) => {
            const id = req.params.id;
            const data = req.body;
            const forCheck = data[0];
            const forUpdate = data[1];
            console.log(forCheck, forUpdate);
            const filter = {_id: new ObjectId(id)};
            const updateDoc = {
                $set: {
                  yes: forUpdate.newYes,
                  no: forUpdate.newNo,
                  like: forUpdate.newLike,
                  dislike: forUpdate.newDisLike,
                  total: forUpdate.newTotal,
                  comments: forUpdate.newComments
                },
              }; 
            const upRsult = await surveysCollection.updateOne(filter, updateDoc);
            const insResult = await attendSurveyCollection.insertOne(forCheck);
            res.send([upRsult, insResult])
        })

        // get who attend survey data
        app.get("/getwhoattendsurvey/:id", async (req, res) =>{
            const id = req.params.id;
            const filter = {submittedSurveyId: id};
            const result = await attendSurveyCollection.find(filter).toArray();
            res.send(result);
        })

        app.get("/paymenthistory", async (req, res) => {
            const result = await paymentsCollection.find().toArray();
            res.send(result);
        })


        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


// -------------------------------------------------------------------------------------------------------------------------------------------------------------
// -------------------------------------------------------------------------------------------------------------------------------------------------------------



app.get('/', (req, res) => {
    res.send('Server of survey is running')
})

app.listen(port, () => {
    console.log(`Server of survey is running on port ${port}`)
})