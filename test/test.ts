import { Nuvira } from 'nuvira-parser';
import { nuv_crud } from '../lib/Adapters/nuv_crud'; 
import { NuviraDb } from '../lib/Core/nuvira';
import { NuviraDbConfig } from '../lib/Types/utiles';

const config: NuviraDbConfig = {
  mode: 'local',
  DirPath: './database', 
  logs: { enable: false } 
};

const db = new NuviraDb(config);

async function test() {
  try {
      const fileName = 'data.nuv';  // Your SQON data file.

      await db.use(fileName, async () => {

        const records = [
          { name: "john doe", age: 30, job: "Software Developer", isActive: false },
          { name: "jane smith", age: 25, job: "Graphic Designer", isActive: true },
          { name: "sielen", age: 23, job: "Marketing Manager", isActive: true, humans: ["name1", "name2", "name3"] },
        ];
        
        // await db.insert(records)
        // .then(success => {
        //   if (success) {
        //     console.log('Record added successfully.');
        //   } else {
        //     console.error('Failed to add record.');
        //   }
        // })
        // .catch((err) => {
        //   console.error('Error:', err);
        // });

        const result = await db.search(
          {
          pipeline: [
            {
              filter: { 
                "Users[_0].name": { $startsWith: 'E'}
              },
            }
          ],
          }
        );
        
       console.log(result);

        const query =           {
          pipeline: [
            {
              filter: { 
                "Users[0].name": { $startsWith: 'E'}
              },
            }
          ],
          };
          const newData = {
            $set: { age: 31, location: "New York" },
          };


        // const testDb = new Nuvira({ filePath: './database/data.nuv'});
        // const testing = await testDb.parse();
        // console.log(testing.relations)
        // db.update(query, newData)
        //     .then(success => {
        //       if (success) {
        //         console.log('Record added successfully.');
        //       } else {
        //         console.error('Failed to add record.');
        //       }
        //     })
        //     .catch((err) => {
        //       console.error('Error:', err);
        //     });
                  

      });
  } catch (error) {
      console.error('Error during Nuvira query processing:', error);
  }
}

test();
