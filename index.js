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
  
  const page = parseInt(request.query.page) || 1;
    const perPage = parseInt(request.query.perPage) || 10;

    const offset = (page - 1) * perPage;

    const getTaskQuery = `
        SELECT * FROM products
        LIMIT ${perPage} OFFSET ${offset};
    `;
  const tasksQuery = await db.all(getTaskQuery)
  response.send(tasksQuery)

})

app.get('/products/:month', async (request, response) => {
  const { month } = request.params;

  // Query to get total sale amount of selected month
  const getTotalSaleAmountQuery = `
      SELECT SUM(price) AS totalSaleAmount
      FROM products
      WHERE strftime("%m", dateOfSale) = '${month}';
  `;

  // Query to get total number of sold items of selected month
  const getTotalSoldItemsQuery = `
      SELECT COUNT(*) AS totalSoldItems
      FROM products
      WHERE sold = 1
      AND strftime("%m", dateOfSale) = '${month}';
  `;

  // Query to get total number of unsold items of selected month
  const getTotalUnsoldItemsQuery = `
      SELECT COUNT(*) AS totalUnsoldItems
      FROM products
      WHERE sold = 0
      AND strftime("%m", dateOfSale) = '${month}';
      ;
  `;

  try {
      // Execute queries
      const totalSaleAmountResult = await db.get(getTotalSaleAmountQuery);
      const totalSoldItemsResult = await db.get(getTotalSoldItemsQuery);
      const totalUnsoldItemsResult = await db.get(getTotalUnsoldItemsQuery);

      // Prepare response object
      const statistics = {
          totalSaleAmount: totalSaleAmountResult.totalSaleAmount,
          totalSoldItems: totalSoldItemsResult.totalSoldItems,
          totalUnsoldItems: totalUnsoldItemsResult.totalUnsoldItems
      };

      response.json(statistics);
  } catch (error) {
      console.error('Error fetching statistics:', error.message);
      response.status(500).json({ error: 'Internal server error' });
  }
});


app.get("/product-range/:month", async (request, response) => {
  const { month } = request.params;
  const getPriceRangeQuery = `
  SELECT 
  price
  FROM
  products
  WHERE 
     strftime("%m",dateOfSale) = "${month}";
  `;

  const priceRange = await db.all(getPriceRangeQuery);
  const priceRanges = [
    { range: '0-100', min: 0, max: 100 },
    { range: '101-200', min: 101, max: 200 },
    { range: '201-300', min: 201, max: 300 },
    { range: '301-400', min: 301, max: 400 },
    { range: '401-500', min: 401, max: 500 },
    { range: '501-600', min: 501, max: 600 },
    { range: '601-700', min: 601, max: 700 },
    { range: '701-800', min: 701, max: 800 },
    { range: '801-900', min: 801, max: 900 },
    { range: '901-above', min: 901, max: Infinity }
  ];
  const categorizedPrices = priceRanges.map(({ range, min, max }) => ({
    range,
    prices: priceRange.filter(({ price }) => price >= min && price <= max)
  }));
  response.send(categorizedPrices);
});

app.get("/product-category/:month", async (request,response) => {
  const { month } = request.params;
  const getQuery = `
    SELECT category FROM products
    WHERE strftime("%m",dateOfSale) = "${month}";
  `;

  const categoryProduct = await db.all(getQuery);
  response.send(categoryProduct);

});


