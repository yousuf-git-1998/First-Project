const express = require("express");
const app = express();
const session = require("express-session");
const raz = require("raz");
const connectToDB = require("./connectToDb");
const dbModel = require("./models/DbModel");
const formidable = require("formidable");
const path = require("path");
const fs = require("fs");
const DbModel = require("./models/DbModel");

raz.register(app); 

const port = 4814
;
app.use(express.static(__dirname + "/businessroot"));
app.use(session({
    secret: 'kit2kat',
    resave: false,
    saveUninitialized: true
})
);
/////////Global vars//////
var categories = [];
var products = [];
var users = [];
var uploadfolder = path.join(__dirname, 'businessroot', 'images');
/////////////////////////////
connect();
getBusiCategories();
getBusiProducts();
app.get("/", async (req, res) => {
  await getBusiCategories();
  await getBusiProducts();
  let authenticated = false;
  let role = "";
  if (req.session.user) {
    authenticated = true;
    role = req.session.user.role;
    
  }
  let productToShow = [];
  if (req.query.c && req.query.s) {
    productToShow = products.filter(
      (v) => v.subcategoryid.toString() == req.query.s
    );
  } else {
    productToShow = products.filter((v) => v.featured);
  }
  res.render("./index", {
    categories: categories,
    products: productToShow,
    authenticated: authenticated,
    role: role,
  });
});
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});
app.get("/cart", async (req, res) => {
  if (!req.session.user) return res.redirect("/login");
  let user = req.session.user;
  await getBusiCart(user._id);
  res.render("cart", {authenticated:true, carts:carts})
});

app.get("/addcart", async (req, res) => {
  if (!req.session.user)
    return res.json({ success: false, msg: "Please login" });
  let id = req.query.id;
  console.log(id);
  let user = req.session.user;

  let product = products.find((x) => x.id.toString() == id);


  await getBusiCart(user._id);
  let cart = carts.find((x) => x.productid == id);
  console.log("found", cart);
  if (cart) {
    cart.quantity += 1;
    cart.save();
  } else {
    let data = {
      userid: user._id,
      productname: product.name,
      productid: product._id,
      quantity: 1,
      price: product.price,
    };
    let model = new dbModel.cartModel(data);
    console.log(model);
    await model.save();
    carts.push(model);
  }
  res.json({ success: true, id: id, msg: "Added to cart" });
});
app.get("/update-cart", async(req, res)=>{
    
    let user = req.session.user;
    await getBusiCart(user._id);
    let cart = carts.find((x) => x._id.toString() == req.query.c);
    
    if(cart){
        cart.quantity = Number(req.query.q);
        cart.save();
    }
    res.json({success:true, msg: 'Cart updated'})
});
app.get("/del-cart-item", async (req, res)=>{
  let user = req.session.user;
  await getBusiCart(user._id);
  let cart = carts.find((x) => x._id.toString() == req.query.c);
  console.log(cart)
  console.log(req.query.c);
  await cart.deleteOne({_id:req.query.c});
  res.json({success:true, msg: 'Item deleted'});
});
app.get("/checkout", async(req, res)=>{
  let user = req.session.user;
  await getBusiCart(user._id);
  let count= 0, amount=0;
  carts.forEach(c=>{
    count += c.quantity;
    amount += c.quantity*c.price
  });
  res.render('checkout', {amount:amount, count:count})
});
app.post('/create-order', async(req, res)=>{
  let user = req.session.user;
  
  await getBusiCart(user._id);
  
  let form = new formidable.IncomingForm();
  const [fields, files] = await form.parse(req);
  let data = { userid: user._id, date:new Date(), address: fields.add[0], status: 'Pending', products:[]};
  carts.forEach(c=>{
    data.products.push({productid: c.productid, productname:c.productname, price: c.price, quantity:c.quantity});
  });
  let model = new dbModel.orderModel(data);
 
  model.save();
  let x= carts;
  x.forEach((c, i)=>{
    console.log('del',c._id);
    carts[i].deleteOne({_id: c._id}).then(r=>console.log('d', r));
  });
  res.render('confirm');
})
app.get("/register", (req, res) => {
  let authenticated = false;
  res.render("register", {
    authenticated: authenticated,
    role: "",
    msg: req.query.msg,
  });
});
app.post("/register", async (req, res) => {
  await getBusiUsers();
  let form = new formidable.IncomingForm();
  const [fields, files] = await form.parse(req);
  let found = users.find((u) => u.username == fields.uname[0]);
  console.log(found);
  if (found) {
    
    return res.redirect("/register?msg=Username exists. choose different one.");
  }
  let data = {
    username: fields.uname[0],
    password: fields.pass[0],
    role: "users",
  };
  let model = new dbModel.userModel(data);
  model.save();
  users.push(model);
  res.redirect("/login");
});
app.get("/login", async (req, res) => {
  await getBusiUsers();
  let authenticated = false;
  res.render("login", {
    authenticated: authenticated,
    role: "",
    msg: req.query.msg,
  });
});
app.post("/login", async (req, res) => {
  let authenticated = false;
  let form = new formidable.IncomingForm();
  const [fields, files] = await form.parse(req);
  let found = users.find(
    (u) => u.username == fields.uname[0] && u.password == fields.pass[0]
  );
  if (found) {
    req.session.user = found;
    return res.redirect("/");
  } else {
    return res.redirect("/login?msg=Login failed. Check username and password");
  }
});
app.get("/admin", async (req, res) => {
  let authenticated = false;
  let role = "";
  if (req.session.user) {
    authenticated = true;
    role = req.session.user.role;
    console.log(req.session.user.role);
  }

  res.render("./admin", { authenticated: authenticated, role: role });
});
app.get("/categories", async (req, res) => {
  
  let modelData = [];
  categories.forEach((c) => {
    let subs = [];
    c.subcategories.forEach((s) => {
      subs.push(s.subcategoryname);
    });
    modelData.push({ categoryname: c.categoryname, subs: subs });
  });
  
  res.render("./categories", { categories: modelData });
});

app.get("/products", async (req, res) => {
  if (!products.length) await getBusiProducts();
  if (!categories.length) await getBusiCategories();
  res.render("./products", { products: products });
});
app.get("/create-category", async (req, res) => {
  res.render("create-category", {
    authenticated: true,
    role: "admin",
    msg: req.query.msg,
  });
});
app.post("/save-category", async (req, res) => {
  let form = new formidable.IncomingForm();
  const [fields, files] = await form.parse(req);
  console.log(fields.cname[0]);
  let data = { categoryname: fields.cname[0], subcategories: [] };
  fields.sname.forEach((s) => {
    data.subcategories.push({ subcategoryname: s });
  });
  let model = new dbModel.categoryModel(data);
  model.save();
  categories.push(model);
  res.redirect("create-category?msg=Data saved");
});
app.get("/create-product", async (req, res) => {
  res.render("./create-product", { categories: categories });
});
app.post("/save-product", async (req, res) => {
  var form = new formidable.IncomingForm({
    keepExtensions: true,
    uploadDir: uploadfolder,
  });

  const [fields, files] = await form.parse(req);
 
  let data = {
    name: fields.name[0],
    price: fields.price[0],
    description: fields.description[0],
    picture: files.picture[0].newFilename,
    categoryid: fields.categoryid[0],
    subcategoryid: fields.subcategoryid[0],
    featured: fields.featured[0] == "on" ? true : false,
  };
  var prodModel = new DbModel.productModel(data);
  console.log("model", prodModel);
  prodModel.save();
  products.push(prodModel);
  res.redirect("/products");
});
app.get('/admin-order', async(req, res)=>{
  await getBusinessData();
  let count= 0, amount=0;
  let data = [];
  orders.forEach(o=>{
    let ord = {id: o._id, userid: o.userid, date: o.date, status: o.status, address: o.address}
    o.products.forEach(p=>{
      count += p.quantity;
      amount += p.quantity*p.price
    })
    o.amount = amount;
    o.count= count;
    data.push(o);
  });
  console.log(data);
  
  res.render("orderlist", {orders: data, authenticated:true})
});

app.get("/get-sub-categories", (req, res) => {
  let cid = req.query.cid;
  console.log(cid);
  let cat = categories.find((v) => v._id.toString() == cid);
  let subs = [];
  if (cat) {
    cat.subcategories.forEach((s) => {
      subs.push({ id: s._id, subcategoryname: s.subcategoryname });
    });
    res.json(subs);
  } else {
    res.json([]);
  }
});

app
  .listen(port, () => {
    console.log("Server is up on port " + port);
  })
  .on("error", (err) => {
    console.error("[!] Error starting server: " + err.message);
  });

async function connect() {
  await connectToDB();
}
async function getBusiCategories() {
  let cats = await dbModel.categoryModel.find();

  categories = cats;
}
async function getBusiProducts() {
  let prods = await dbModel.productModel.find();
 
  products = prods;
}
async function getBusiUsers() {
  let userlist = await dbModel.userModel.find();
  
  users = userlist;
}
async function getBusiCart(id) {
  console.log(id);
  let cart = await dbModel.cartModel.find();
  carts = cart;

}
async function getBusinessData(){
  let data=await dbModel.orderModel.find();
  orders = data;
}
