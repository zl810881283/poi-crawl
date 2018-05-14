let rp = require('request-promise')
let { interval, of } = require('rxjs')
let { map, flatMap, filter, scan, skip, take, retry, catchError, retryWhen } = require('rxjs/operators')
let cheerio = require('cheerio');
let { MongoClient } = require('mongodb')

const START_COUNT = 1
const ALL_COUNT = 31727114

let rpap = rp.defaults({ transform: body => cheerio.load(body) });

async function crawl(id) {
  const url = `http://www.poi86.com/poi/amap/${id}.html`
  let $ = await rpap(url)
  let res = { id, "地点名称": $(".panel-heading h1").text() }

  try {
    Array.prototype.map.call($(".list-group li"), i => $(i).text())
      .map(i => i.split(":").map(i => i.trim()))
      .forEach(i => {
        switch (i[0]) {
          case '所属分类':
            res[i[0]] = i[1].split(";")
            break
          case '大地坐标':
          case '火星坐标':
          case '百度坐标':
            res[i[0]] = i[1].split(",").map(i => +i)
            break
          default:
            res[i[0]] = i[1]
        }
      })
  } catch (err) { console.log(err) }
  console.log(res)
  return res
}

async function main() {
  let mongoConnect = await MongoClient.connect("mongodb://localhost:27017", { useNewUrlParser: true })
  let collection = mongoConnect.db("poi-data").collection("poi")
  interval(500).pipe(
    map(i => i + START_COUNT),
    take(ALL_COUNT - START_COUNT + 1),
    flatMap(i => {
      console.log(`访问 id: ${i}`)
      return of(i).pipe(
        flatMap(i => crawl(i)),
        retryWhen(() => interval(1000).pipe(take(3))),
      )
    }),

  ).subscribe((i) => {
    console.log(i)
    collection.insert(i)
  })
}

main()