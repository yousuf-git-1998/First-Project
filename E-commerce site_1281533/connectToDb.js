const mongoose = require('mongoose');
const connectToDB = async () => {
    try {
        await mongoose.connect("mongodb+srv://users:Shuvo194198@cluster0.sleifq1.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0", {
           
        })
        console.log('Connected to Mongodb Atlas');} catch (error) {
        console.error(error);
    }
}
module.exports =connectToDB;
