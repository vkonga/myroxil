const express = require('express')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const path = require('path')
const cors = require('cors')

const dbPath = path.join(__dirname, 'roxilbackenddb.db')
const app = express()
app.use(express.json())
app.use(cors());
let db = null

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })

    app.listen(3000, () => {
      console.log("Server is running at server 'http://localhost:3000/")
    })
  } catch (error) {
    console.log(`DB Error: ${error.message}`)
    process.exit(1)
  }
}

initializeDBAndServer()

const axios = require('axios') /*Importing the axios library*/

const fetchAndInsert = async () => {
  const response = await axios.get(
    'https://s3.amazonaws.com/roxiler.com/product_transaction.json',
  )
  const data = response.data

  for (let item of data) {
    const queryData = `SELECT id FROM products WHERE id = ${item.id}`
    const existingData = await db.get(queryData)
    if (existingData === undefined) {
      const query = `
   INSERT INTO products (id, title, price, description, category, image, sold, dateOfSale) 
   VALUES (
       ${item.id},
       '${item.title.replace(/'/g, "''")}',
       ${item.price},
       '${item.description.replace(/'/g, "''")}',
       '${item.category.replace(/'/g, "''")}',
       '${item.image.replace(/'/g, "''")}',
       ${item.sold},
       '${item.dateOfSale.replace(/'/g, "''")}'
   );
` /*The .replace(/'/g, "''") in the SQL query helps prevent SQL injection attacks by escaping single quotes.*/

      await db.run(query)
    }
  }
  console.log('Transactions added')
}

fetchAndInsert()

app.get('/', async (request, response) => {
    const { month = "", s_query = "", limit = 10, offset = 0 } = request.query;
    const getQuery = `
    SELECT * FROM products
    WHERE
    (title LIKE ? OR description LIKE ? OR price LIKE ?)
    AND strftime('%m', dateOfSale) LIKE ?
    LIMIT ? OFFSET ?;`;

    const params = [
        `%${s_query}`,
        `%${s_query}`,
        `%${s_query}`,
        `%${month}`,
        limit,
        offset,
    ];

    const getSalesQuery = `SELECT COUNT(id) AS total
    FROM products
    WHERE
    (title LIKE ? OR description LIKE ? OR price LIKE ?)
    AND strftime('%m', dateOfSale) LIKE ?;`;

    const salesparams = [
        `%${s_query}`,
        `%${s_query}`,
        `%${s_query}`,
        `%${month}`,
    ];

    const data = await db.all(getQuery, params);
    const total = await db.get(getSalesQuery, salesparams);
    response.send({ transactionsList: data, total })
});

app.get('/statistics', async (request, response) => {
    const { month = "" } = requset.query;
    const totalSalesAmount = await db.get(
        `SELECT SUM(price) as total FROM products WHERE strftime('%m', dateOfSale) LIKE '%${month}';`
    )

    const soldItems = await db.get(
        `SELECT COUNT(id) as sold FROM products WHERE strftime('%m', dateOfSale) LIKE '%${month}' AND sold=1;`
    )

    const notSoldItems = await db.get(
        `SELECT COUNT(id) as notSold FROM products WHERE strftime('%m', dateOfSale) LIKE '%${month}' AND sold=0;`
    )

    response.send({ totalSalesAmount, soldItems, notSoldItems })

});

app.get('/barChart', async (request, response) => {
    const { month = '' } = request.query;
    const priceRange = [
        { min: 0, max: 100 },
        { min: 101, max: 200 },
        { min: 201, max: 300 },
        { min: 301, max: 400 },
        { min: 401, max: 500 },
        { min: 501, max: 600 },
        { min: 601, max: 700 },
        { min: 701, max: 800 },
        { min: 801, max: 900 },
        { min: 901, max: 10000 },
    ];

    const barChartList = [];

    for (const range of priceRange) {
        const data = await db.get(
            `SELECT COUNT(id) as count FROM products
            WHERE strftime('%m', dateOfSale) LIKE '%${month}%' AND price  >= ${range.min} AND price <=${range.max}; `
        );

        barChartList.push({
            range: `${range.min} - ${range.max}`,
            count: data.count,
        });
    }

    response.send({ barChartList });
});

app.get('/pieChart', async (request, response) => {
    const { month = '' } = request.query;
    const piechartList = await db.all(
        `SELECT category, COUNT(id) as count FROM products
        WHERE strftime('%m', dateOfSale) Like '%${month}'
        GROUP BY category;`
    );

    response.send({ piechartList })
});


app.get("/combinedResponse", async (request, response) => {
    const { month = "", s_query = "", limit = 10, offset = 0 } = request.query;

    const initializeDatabase = await axios.get(
        `https://roxiler-systems-assignment.onrender.com/initialize-database`
    );
    const initializeResponse = await initializeDatabase.data;
    const TransactionsList = await axios.get(
        `https://roxiler-systems-assignment.onrender.com/transactions?month=${month}&s_query=${s_query}&limit=${limit}&offset=${offset}`
    );
    const TransactionsResponse = await TransactionsList.data;
    const statisticsList = await axios.get(
        `https://roxiler-systems-assignment.onrender.com/statistics?month=${month}`
    );
    const statisticsResponse = await statisticsList.data;
    const barChartResponse = await axios.get(
        `https://roxiler-systems-assignment.onrender.com/bar-chart?month=${month}`
    );
    const barChartList = await barChartResponse.data;
    const pieChartResponse = await axios.get(
        `https://roxiler-systems-assignment.onrender.com/pie-chart?month=${month}`
    );
    const pieChartList = await pieChartResponse.data;

    const combinedResponse = {
        initialize: initializeResponse,
        listTransactions: TransactionsResponse,
        statistics: statisticsResponse,
        barChart: barChartList,
        pieChart: pieChartList,
    };

    response.send(combinedResponse);
});
