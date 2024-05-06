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

app.get('/transactions', async (req, res) => {
    const { month = "", s_query = "", limit = 10, offset = 0 } = req.query;
    const searchQuery = `
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

    const totalItemQuery = `SELECT COUNT(id) AS total
    FROM products
    WHERE
    (title LIKE ? OR description LIKE ? OR price LIKE ?)
    AND strftime('%m', dateOfSale) LIKE ?;`;

    const totalparams = [
        `%${s_query}`,
        `%${s_query}`,
        `%${s_query}`,
        `%${month}`,
    ];

    const data = await db.all(searchQuery, params);
    const total = await db.get(totalItemQuery, totalparams);
    res.json({ transactionsData: data, total })
});

app.get('/statistics', async (req, res) => {
    const { month = "" } = req.query;
    const totalAmount = await db.get(
        `SELECT SUM(price) as total FROM products WHERE strftime('%m', dateOfSale) LIKE '%${month}';`
    )

    const soldItems = await db.get(
        `SELECT COUNT(id) as sold FROM products WHERE strftime('%m', dateOfSale) LIKE '%${month}' AND sold=1;`
    )

    const notSoldItems = await db.get(
        `SELECT COUNT(id) as notSold FROM products WHERE strftime('%m', dateOfSale) LIKE '%${month}' AND sold=0;`
    )

    res.json({ totalAmount, soldItems, notSoldItems })

});

app.get('/bar-chart', async (req, res) => {
    const { month = '' } = req.query;
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

    const barChartData = [];

    for (const range of priceRange) {
        const data = await db.get(
            `SELECT COUNT(id) as count FROM products
            WHERE strftime('%m', dateOfSale) LIKE '%${month}%' AND price  >= ${range.min} AND price <=${range.max}; `
        );

        barChartData.push({
            range: `${range.min} - ${range.max}`,
            count: data.count,
        });
    }

    res.json({ barChartData });
});

app.get('/pie-chart', async (req, res) => {
    const { month = '' } = req.query;
    const piechartData = await db.all(
        `SELECT category, COUNT(id) as count FROM products
        WHERE strftime('%m', dateOfSale) Like '%${month}'
        GROUP BY category;`
    );

    res.json({ piechartData })
});


app.get("/combined-response", async (req, res) => {
    const { month = "", s_query = "", limit = 10, offset = 0 } = req.query;

    const initializeDatabase = await axios.get(
        `https://roxiler-systems-assignment.onrender.com/initialize-database`
    );
    const initializeResponse = await initializeDatabase.data;
    const TransactionsData = await axios.get(
        `https://roxiler-systems-assignment.onrender.com/transactions?month=${month}&s_query=${s_query}&limit=${limit}&offset=${offset}`
    );
    const TransactionsResponse = await TransactionsData.data;
    const statisticsData = await axios.get(
        `https://roxiler-systems-assignment.onrender.com/statistics?month=${month}`
    );
    const statisticsResponse = await statisticsData.data;
    const barChartResponse = await axios.get(
        `https://roxiler-systems-assignment.onrender.com/bar-chart?month=${month}`
    );
    const barChartData = await barChartResponse.data;
    const pieChartResponse = await axios.get(
        `https://roxiler-systems-assignment.onrender.com/pie-chart?month=${month}`
    );
    const pieChartData = await pieChartResponse.data;

    const combinedResponse = {
        initialize: initializeResponse,
        listTransactions: TransactionsResponse,
        statistics: statisticsResponse,
        barChart: barChartData,
        pieChart: pieChartData,
    };

    res.json(combinedResponse);
});
