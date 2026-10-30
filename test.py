variable = 10
print(type(variable))

fruit = ['apple', 'seb','papaya', 'mango', 'banana']

print(fruit[1:4])
print(fruit[-4])

for f in fruit:                   #fFull traversal
    print(f'fruits: {f}') 

for i in range(len(fruit)):       #half, indexed based traversal
    print(f'fruits: {fruit[i]}')


fin = {'a':10 , 'b':20, 'c':30}
fin['d'] = 60

for f in fin:
    print(f)